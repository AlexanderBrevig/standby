// Simulated end-to-end cases for tests/run.sh (needs harness.js). Each check logs "ok" or "FAIL".
const check = (name, cond, info = "") => LOG.push((cond ? "ok   " : "FAIL ") + name + (cond ? "" : "  " + info));
(async () => { try {
  // 1. reload drill with noise, tap scoring, adaptive calibration
  let results = [];
  await runSet("reload drill P R P, 4 reps", { mode: "drill", pattern: "P R P", reps: 4, parMode: "adaptive", score: true },
    (s, r) => [[1.0, 1.25, 1.45, 1.6, 3.05, 3.3], [1.0, 1.2, 2.6, 2.8], [0.9, 1.1, 2.75, 2.9, 3.1], [0.9, 1.1, 2.4, 2.6]][r],
    [[/Score\?/, "all alpha"], [/Score\?/, "three alpha one charlie"], [/Score\?/, "alpha alpha alpha mike"], [/Score\?/, "all alpha"]]);
  const log = load("standby.log", []).reverse();
  check("4 reps logged", log.length === 4, log.length);
  check("rep1 mag drop+bounce filtered", log[0] && log[0].total.toFixed(2) === "3.30" && log[0].extras === 2, JSON.stringify(log[0]));
  check("rep3 slide release filtered", log[2] && log[2].total.toFixed(2) === "3.10", log[2] && log[2].total);
  check("scores parsed", log.map(e => e.score).join() === "AAAA,AAAC,AAAM,AAAA", log.map(e => e.score).join());
  check("adaptive set after 3", parState("P R P").par > 0, JSON.stringify(parState("P R P")));
  check("set summary spoken", SAID.some(t => t.startsWith("Set done. 4 reps")), SAID.slice(-2).join(" | "));

  // 2. reload drill must not end on mag noise: drop at 1.7 fits count, shot after reload at 3.4
  await runSet("P1 R P1 slow reload", { mode: "drill", pattern: "P1 R P1" }, () => [1.0, 1.7, 3.2, 3.4]);
  check("didn't end mid-reload", lastLog() && lastLog().total.toFixed(2) === "3.40", JSON.stringify(lastLog()));

  // 3. shot right after the par beep counts (beeps go to the beep input now)
  await runSet("fixed par 1.5, shot at 1.53", { mode: "drill", pattern: "P", parMode: "fixed", par: 1.5 }, () => [1.0, 1.53]);
  check("shot near par counted", lastLog() && lastLog().n === 2 && lastLog().total.toFixed(2) === "1.53", JSON.stringify(lastLog()));
  check("par beep scheduled", beeps.some(b => b.dur === PAR_BEEP));

  // 4. early start re-shoots in a set, beeps cancelled
  beeps.length = 0;
  await runSet("early then ok", { mode: "drill", pattern: "P1", reps: 2 }, (s, r) => r === 0 ? "early" : [0.95]);
  check("early cancels the beep", beeps[0] && beeps[0].cancelled, JSON.stringify(beeps[0]));
  check("early rep re-shot", SAID.includes("Early. Before the beep.") && load("standby.log", []).slice(0, 2).every(e => e.pattern === "P1"));

  // 5. course mode
  await runSet("course", { mode: "course", startPos: "ready" }, () => [0.6, 0.9, 1.2]);
  check("course logged", lastLog().n === 3 && lastLog().labels[0] === "first shot", JSON.stringify(lastLog()));

  // 6. briefing: repeat then continue; table command
  await runSet("briefing repeat/continue", { mode: "drill", pattern: "P S P", startPos: "table", confirm: true }, () => [1.4, 1.65, 2.0, 2.3],
    [[/Say continue/, "repeat please"], [/Say continue/, "continue"]]);
  check("briefing read twice then make ready", SAID.filter(t => t.includes("Say continue")).length === 2 && SAID.includes("Make ready"), SAID.join(" | "));
  check("briefing text", SAID[0] === "From table. Paper, steel, paper. Say continue to proceed.", SAID[0]);

  // 7. no voice recognition: briefing continues by itself
  await runSet("no voice: auto continue", { mode: "drill", pattern: "P", startPos: "ready", confirm: true, voice: false }, () => [1.0, 1.25]);
  check("auto-continued", SAID.includes("Load and make ready") && lastLog().n === 2, SAID.join(" | "));

  // 8. "next" in the briefing restarts exactly once
  setup({ mode: "called", calledFrom: "pool", pool: "P S\n2S\nP", confirm: true, reps: 1 }); SAID.length = 0; rep = 0; PLAN = () => [1, 1.3, 1.6];
  REPLIES = [[/Say continue/, "next"], [/Say continue/, "continue"]];
  let restarts = 0; const origRestart = restart; restart = () => { restarts++; origRestart(); };
  startSession(); await until(() => state === "idle"); restart = origRestart;
  check("next restarts once", restarts === 1, restarts);

  // 9. stop during "Set paused" speech doesn't bring the set back
  setup({ mode: "drill", pattern: "P1", reps: 3 }); SAID.length = 0; rep = 0; PLAN = () => [1.0];
  REPLIES = [[/^Next in/, "stop"]];
  startSession();
  await until(() => SAID.includes("Set paused. Say restart to continue."), 30000);
  $("stop").click(); await sleep(600);
  check("stop during pause clears it", pending === null && state === "idle" && $("start").textContent === "Start", `${JSON.stringify(pending)} ${state} ${$("start").textContent}`);

  // 10. restart during the final set summary starts a new set, not the summary again
  setup({ mode: "drill", pattern: "P1", reps: 2, repInterval: 2 }); SAID.length = 0; rep = 0; PLAN = () => [1.0];
  startSession();
  await until(() => SAID.some(t => t.startsWith("Set done")), 30000);
  $("start").click();   // Restart rep during the summary
  await sleep(300);
  check("restart in summary begins a new set", state === "running" && activeSet && activeSet.rep === 0, `${state} ${JSON.stringify(activeSet && activeSet.rep)}`);
  $("stop").click(); await sleep(300);

  // 11. restart after switching mode mid-set: no crash, runs the new mode
  setup({ mode: "drill", pattern: "P1", reps: 3 }); SAID.length = 0; rep = 0; PLAN = () => [1.0];
  startSession();
  await until(() => activeSet && activeSet.rep === 1, 30000);
  $("mode").value = "course"; $("mode").dispatchEvent(new Event("change"));
  $("start").click(); await sleep(500);
  check("restart after mode change", state === "running" && activeSet.reps === 1 && !LOG.some(l => l.startsWith("ERROR") || l.startsWith("REJECT")), `${state} ${activeSet && activeSet.reps}`);
  $("stop").click(); await sleep(300);

  // 12. restart during the results speech counts the rep once and moves on
  setup({ mode: "drill", pattern: "P1", reps: 3 }); SAID.length = 0; rep = 0; PLAN = () => [1.0];
  localStorage.removeItem("standby.log");
  startSession();
  await until(() => SAID.some(t => t.startsWith("Total")), 30000);
  $("start").click(); await sleep(200);
  check("rep counted once, set moved on", activeSet && activeSet.rep === 1 && load("standby.log", []).length === 1, `${activeSet && activeSet.rep} ${load("standby.log", []).length}`);
  $("stop").click(); await sleep(300);

  // 13. pause and resume a set: button says Resume set
  setup({ mode: "drill", pattern: "P1", reps: 3 }); SAID.length = 0; rep = 0; PLAN = () => [1.0];
  REPLIES = [[/^Next in/, "hold on"]];
  startSession(); await until(() => state === "idle", 30000);
  check("resume label", /^Resume set \(2\/3\)/.test($("start").textContent), $("start").textContent);
  startSession(); await until(() => state === "idle", 60000);
  check("resumed to the end", SAID.some(t => t.startsWith("Set done. 3 reps")), SAID.slice(-1)[0]);

  // 15. hands-free setup: confirm applies, cancel doesn't, undo restores
  setup({ mode: "course", startPos: "holster", reps: 1, parMode: "off" }); SAID.length = 0;
  REPLIES = [[/confirm or cancel/, "confirm"]];
  setupFlow(["setup bill drill from table, five reps, par adaptive"]); await until(() => state === "idle");
  check("setup applied", S.mode === "drill" && S.pattern === "P6" && S.startPos === "table" && S.reps === 5 && S.parMode === "adaptive" && $("pattern").value === "P6", JSON.stringify([S.mode, S.pattern, S.startPos, S.reps, S.parMode]));
  check("setup readback", SAID.some(t => t.startsWith("Drill, Bill drill. From table. Five reps. Adaptive par. Say confirm or cancel.")), SAID.join(" | "));
  REPLIES = [[/confirm or cancel/, "cancel"]];
  setupFlow(["setup course"]); await until(() => state === "idle");
  check("setup cancelled", S.mode === "drill", S.mode);
  setupFlow(["setup undo"]); await until(() => state === "idle");
  check("setup undo", S.mode === "course" && S.startPos === "holster" && S.reps === 1 && S.parMode === "off", JSON.stringify([S.mode, S.startPos, S.reps, S.parMode]));
  // silence cancels
  REPLIES = [];
  setupFlow(["setup drill"]); await until(() => state === "idle", 20000);
  check("setup silence cancels", S.mode === "course", S.mode);

  // 16. "and go" applies and starts the string
  localStorage.removeItem("standby.log"); rep = 0; PLAN = () => [1.0];
  REPLIES = [[/confirm or cancel/, "yes"]];
  setupFlow(["set up draw drill from the table and go"]);
  await until(() => state === "running"); await until(() => state === "idle");
  check("setup and go ran the drill", lastLog() && lastLog().pattern === "P1" && lastLog().start === "table", JSON.stringify(lastLog()));

  // 17. save and load a named setup; buttons confirm and cancel
  REPLIES = [[/confirm or cancel/, "confirm"]];
  setupFlow(["setup save as warm up"]); await until(() => state === "idle");
  check("setup saved", load("standby.setups", {})["warm up"] && load("standby.setups", {})["warm up"].pattern === "P1");
  applySettings({ mode: "course", startPos: "holster" });
  REPLIES = [];
  setupFlow(["setup warm up"]); await until(() => $("start").textContent === "Confirm" && !$("start").disabled);
  $("start").click(); await until(() => state === "idle");
  check("setup loaded by name (Confirm button)", S.mode === "drill" && S.pattern === "P1" && S.startPos === "table", JSON.stringify([S.mode, S.pattern, S.startPos]));
  setupFlow(["setup course"]); await until(() => $("stop").textContent === "Cancel" && !$("start").disabled);
  $("stop").click(); await sleep(300);
  check("setup Cancel button", S.mode === "drill" && state === "idle", S.mode + " " + state);

  // 18. "setup start position …" never starts a string; "restart" does
  let starts = 0; const origStart = startSession; startSession = () => { starts++; return false; };
  idleText("setup start position table"); idleText("set up, start holster");
  check("setup speech doesn't start", starts === 0, starts);
  idleText("restart"); check("restart starts", starts === 1, starts);
  S.handsFree = false; idleText("setup start position table"); check("hands-free off: \"start\" starts as before", starts === 2, starts); S.handsFree = true;
  startSession = origStart;

  // 19. quick tour: opens when idle, steps through, the last step closes it; actions work
  localStorage.removeItem("standby.toured");
  $("help").click();
  check("tour opens", $("tour").open && $("tourStep").textContent === "1 / " + TOUR.length, $("tourStep").textContent);
  check("tour back disabled on step 1", $("tourBack").disabled);
  for (let k = 1; k < TOUR.length; k++) $("tourNext").click();
  check("tour last step", $("tourNext").textContent === "Done" && $("tourTitle").textContent === "Your first session", $("tourTitle").textContent);
  $("tourBody").querySelector("[data-act=doubles]").click(); await sleep(100);
  check("tour loads Doubles", !$("tour").open && S.mode === "drill" && S.pattern === "P" && S.reps === 5, JSON.stringify([$("tour").open, S.mode, S.pattern, S.reps]));
  check("tour remembered", load("standby.toured", false) === true);
  state = "running"; $("help").click(); check("no tour while running", !$("tour").open); state = "idle";

  // 20. without a first tap, a string can't start (browsers block the audio): it says so instead
  gestured = false;
  check("no start before a tap", startSession() === false && state === "idle" && statusText === "Tap to wake the audio", statusText);
  check("idle hint asks for a tap", idleHint() === "Tap anywhere once to wake the audio.");
  gestured = true;

  // 14. generated course + score over 12 shots prompt uses digits
  check("numWord 15", numWord(15) === "15");
  check("no errors", !LOG.some(l => l.startsWith("ERROR") || l.startsWith("REJECT")));
  } catch (e) { LOG.push("EXC " + e.stack); }
  done();
})();
