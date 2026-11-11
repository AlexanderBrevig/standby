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
  setup({ mode: "drill", pattern: "P1", reps: 2 }); SAID.length = 0; rep = 0; PLAN = () => [1.0];
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

  // 21. "repeat" shoots the last course again (called mode, random start); "restart" draws a new one
  setup({ mode: "called", calledFrom: "pool", pool: "P S\n2S\nP\nP S P\n2P S", startPos: "random", reps: 1 }); SAID.length = 0; rep = 0;
  PLAN = s => s.drill.shots.map((_, i) => 1 + i * 0.3);
  localStorage.removeItem("standby.log");
  startSession(); await until(() => state === "idle");
  const firstRun = lastLog();
  idleText("repeat"); await until(() => state === "running"); await until(() => state === "idle");
  const again = lastLog();
  check("repeat: same course and start", again && firstRun && again.at !== firstRun.at && again.pattern === firstRun.pattern && again.start === firstRun.start, JSON.stringify([firstRun && [firstRun.pattern, firstRun.start], again && [again.pattern, again.start]]));
  check("idle hint offers the same course", /same course/.test(idleHint()), idleHint());
  // between reps
  setup({ mode: "called", calledFrom: "pool", pool: "P S\n2S\nP\nP S P\n2P S", startPos: "random", reps: 2 }); SAID.length = 0; rep = 0;
  REPLIES = [[/^Next in/, "repeat"]];
  localStorage.removeItem("standby.log");
  startSession(); await until(() => state === "idle");
  const two = load("standby.log", []);
  check("repeat between reps", two.length === 2 && two[0].pattern === two[1].pattern && two[0].start === two[1].start && SAID.includes("Same course again."), JSON.stringify(two.map(e => [e.pattern, e.start])));
  // changed settings: no repeat
  applySettings({ startPos: "holster", mode: "drill" }); check("no repeat after settings change", !canRepeat());

  // 22. mic sheet: room, three clicks, threshold between; Done goes back to idle; "Mic test" opens it as a meter
  localStorage.removeItem("standby.calibrated"); applySettings({ threshold: DEFAULTS.threshold }); localStorage.removeItem("standby.calibrated");
  check("uncalibrated at default", !isCalibrated());
  await openCalib(true);
  check("mic sheet open", $("calib").open && state === "test" && calib.phase === "room");
  for (let k = 0; k < 30; k++) { calibPeak(0, ctx.currentTime); await sleep(50); }   // a mic just opened: digital silence
  check("silence before the mic delivers isn't the room", calib.phase === "room" && calib.t0 === null && !calib.noise.length, JSON.stringify(calib.noise.slice(0, 3)));
  // the threshold from the shots, not the room: a real session (room -62, shots -8 -2 -5, typing -19 -20)
  check("calib: typing between shots isn't a shot", calibThreshold(-62, [-8, -2, -19, -20]).thr === null, JSON.stringify(calibThreshold(-62, [-8, -2, -19, -20])));
  check("calib: under the median shot, above the typing", calibThreshold(-62, [-8, -2, -19, -20, -5]).thr === -15, JSON.stringify(calibThreshold(-62, [-8, -2, -19, -20, -5])));
  check("calib: every shot would trigger it", calibThreshold(-62, [-2, -2, -11]).thr === -14, calibThreshold(-62, [-2, -2, -11]).thr);
  check("calib: shots close to the room: well clear of the room, still under the shots", calibThreshold(-40, [-27, -27, -27]).thr === -30, calibThreshold(-40, [-27, -27, -27]).thr);
  for (let k = 0; k < 40; k++) { calibPeak(k % 10 ? 0.01 : 0.02, ctx.currentTime); await sleep(50); }   // the room: -40 dB, peaks at -34
  check("room measured", calib.phase === "clicks", calib && calib.phase);
  check("room is its louder moments", Math.round(roomLevel(calib.noise)) === -34, roomLevel(calib.noise));
  const shot = async a => { calibPeak(a, ctx.currentTime); await sleep(100); calibPeak(0.01, ctx.currentTime); await sleep(1000); };   // a shot, then the room
  for (let k = 0; k < 20; k++) { calibPeak(0.3, ctx.currentTime); await sleep(50); }   // a bump: a second of rumble
  calibPeak(0.01, ctx.currentTime); await sleep(1000);
  check("a bump is one shot, not three", calib.clicks.length === 1 && S.threshold === DEFAULTS.threshold, calib.clicks.length);
  await shot(0.3);
  check("no threshold before three shots", S.threshold === DEFAULTS.threshold && $("calibDone").textContent === "Skip", S.threshold);
  await shot(0.3);   // shots: about -10 dB
  const room = () => roomLevel(calib.noise);   // followed between shots
  const thrFor = shots => calibThreshold(room(), shots.map(ampDb)).thr;
  const want = thrFor([0.3, 0.3, 0.3]);
  check("calibrated threshold", S.threshold === want && $("threshold").value === String(want) && isCalibrated() && $("calibDone").textContent === "Done", S.threshold + " want " + want);
  await shot(0.05);   // typing between the shots: ignored, it doesn't drag the threshold down
  check("soft sounds ignored", S.threshold === want && /1 soft sound ignored/.test($("calibHits").innerHTML) && /<s>-26<\/s>/.test($("calibHits").innerHTML), S.threshold + " | " + $("calibHits").innerHTML);
  await shot(0.6);   // a louder shot: it keeps listening and refines
  const want2 = thrFor([0.3, 0.3, 0.3, 0.6]);
  check("keeps refining until Done", S.threshold === want2 && /from 4 shots/.test($("calibStatus").textContent), S.threshold + " want " + want2 + " | " + $("calibStatus").textContent);
  $("calibDone").click(); await sleep(100);
  check("mic sheet closes to idle", !$("calib").open && state === "idle", state);
  $("test").click(); await sleep(100);
  check("mic test opens the sheet as a meter", $("calib").open && calib.phase === "done" && new RegExp("Threshold " + want2 + " dB").test($("calibStatus").textContent), $("calibStatus").textContent);
  testHit(ctx.currentTime); check("meter counts shots", /1<\/b> shot heard/.test($("calibHits").innerHTML), $("calibHits").innerHTML);
  $("calibClose").click(); await sleep(100);
  applySettings({ threshold: DEFAULTS.threshold });

  // 23. first visit: the tour, then the mic setup
  localStorage.removeItem("standby.calibrated"); applySettings({ threshold: DEFAULTS.threshold }); localStorage.removeItem("standby.calibrated");
  calibAfterTour = true; openTour();
  check("first visit: tour first", $("tour").open && !$("calib").open);
  for (let k = 1; k < TOUR.length; k++) $("tourNext").click();
  $("tourNext").click(); await sleep(100);   // Done
  check("first visit: mic setup after the tour", !$("tour").open && $("calib").open && state === "test" && calib.phase === "room", `${$("tour").open} ${$("calib").open} ${state}`);
  closeCalib(); await sleep(100);
  check("first visit: skipped, not asked again", state === "idle" && !isCalibrated() && !askCalib(), state);
  check("skipped: the idle hint says the mic isn't tuned", /isn.t tuned/.test(idleHint()), idleHint());
  $("test").click(); await sleep(100);
  check("skipped: Mic test calibrates instead of only showing the meter", $("calib").open && calib.phase === "room", calib && calib.phase);
  closeCalib(); await sleep(100);
  localStorage.removeItem("standby.calibSkipped");
  openTour(); closeTour(); await sleep(100);
  check("later tours don't reopen the mic setup", !$("calib").open && state === "idle");
  applySettings({ threshold: DEFAULTS.threshold });

  // 24. Stop during a long called briefing: back to the idle face, the preview fits
  setup({ mode: "called", calledFrom: "pool", pool: "2P S R P S 2S M P 2S", confirm: true, startPos: "holster", reps: 1 }); SAID.length = 0; REPLIES = [];
  startSession(); await until(() => confirmGo !== null);
  check("briefing shows the long course", $("big").classList.contains("mn") && document.body.classList.contains("running"));
  $("stop").click(); await sleep(100);
  const big = $("big");
  check("stop: idle face with the preview", state === "idle" && statusText === "Idle" && big.textContent.replace(/\s+/g, " ").trim() === setupMarks(S), `${statusText} | ${big.textContent}`);
  check("stop: nothing overflows", big.scrollWidth <= big.clientWidth + 1, `${big.scrollWidth} > ${big.clientWidth}`);

  // 25. restart = the same course again; next / Start = a new one; the Restart rep button keeps the course
  setup({ mode: "called", calledFrom: "pool", pool: "P S\n2S\nP\nP S P\n2P S", startPos: "random", confirm: false, reps: 1 }); SAID.length = 0; rep = 0; REPLIES = [];
  PLAN = s => s.drill.shots.map((_, i) => 1 + i * 0.3);
  localStorage.removeItem("standby.log");
  startSession(); await until(() => state === "idle");
  const a = lastLog();
  idleText("restart"); await until(() => state === "running"); await until(() => state === "idle");
  const b = lastLog();
  check("restart: same course", b.at !== a.at && b.pattern === a.pattern && b.start === a.start, JSON.stringify([[a.pattern, a.start], [b.pattern, b.start]]));
  idleText("next"); await until(() => state === "running"); await until(() => state === "idle");
  const c = lastLog();
  check("next: a new course", c.at !== b.at && c.pattern !== b.pattern, JSON.stringify([b.pattern, c.pattern]));
  setup({ mode: "called", calledFrom: "pool", pool: "P S\n2S\nP\nP S P\n2P S", startPos: "holster", confirm: true, reps: 1 }); SAID.length = 0; REPLIES = [];
  startSession(); await until(() => confirmGo !== null);
  const before = currentCourse.drill.key;
  confirmGo = null; $("start").click(); await until(() => confirmGo !== null);   // Restart rep (not Continue)
  check("Restart rep button: same course", currentCourse.drill.key === before && state === "running", `${before} -> ${currentCourse.drill.key}`);
  $("stop").click(); await sleep(100);

  // 26. every rep briefed: no countdown between reps; "restart" in the briefing goes back to the last course; "stop" pauses
  setup({ mode: "called", calledFrom: "pool", pool: "P S\n2S\nP\nP S P\n2P S", startPos: "holster", confirm: true, reps: 2 }); SAID.length = 0; rep = 0;
  PLAN = s => s.drill.shots.map((_, i) => 1 + i * 0.3);
  REPLIES = [[/Say continue/, "continue"], [/Say continue/, "restart"], [/Say continue/, "continue"]];
  localStorage.removeItem("standby.log");
  startSession(); await until(() => state === "idle", 60000);
  const two2 = load("standby.log", []);
  check("no countdown when every rep is briefed", !SAID.some(t => /^Next in/.test(t)), SAID.join(" | "));
  check("restart in the briefing: the last course again", two2.length === 2 && two2[0].pattern === two2[1].pattern, JSON.stringify(two2.map(e => e.pattern)));
  setup({ mode: "called", calledFrom: "pool", pool: "P S\n2S\nP", startPos: "holster", confirm: true, reps: 3 }); SAID.length = 0; rep = 0;
  REPLIES = [[/Say continue/, "continue"], [/Say continue/, "stop"]];
  startSession(); await until(() => state === "idle", 60000);
  check("stop in the briefing pauses the set", pending && pending.rep === 1 && SAID.includes("Set paused. Say restart to continue."), JSON.stringify(pending && pending.rep));
  pending = null;
  // a drill with "wait for continue": a briefing before every rep, no countdown; with it off: the countdown
  setup({ mode: "drill", pattern: "P1", startPos: "holster", confirm: true, reps: 2 }); SAID.length = 0; rep = 0; REPLIES = [[/Say continue/, "continue"], [/Say continue/, "continue"]]; PLAN = () => [1.0];
  startSession(); await until(() => state === "idle", 60000);
  check("drill: continue before every rep", SAID.filter(t => /Say continue/.test(t)).length === 2 && !SAID.some(t => /^Next in/.test(t)), SAID.join(" | "));
  setup({ mode: "drill", pattern: "P1", startPos: "holster", confirm: false, reps: 2 }); SAID.length = 0; rep = 0; REPLIES = []; PLAN = () => [1.0];
  startSession(); await until(() => state === "idle", 60000);
  check("drill without continue: the countdown", SAID.some(t => /^Next in/.test(t)) && !SAID.some(t => /Say continue/.test(t)), SAID.join(" | "));

  // 27. a saved setup from before the rep interval was retired still loads
  applySettings({ repInterval: 5, reps: 2 }); check("retired setting ignored", S.reps === 2 && !("repInterval" in S) && !LOG.some(l => /^(ERROR|REJECT)/.test(l)));
  applySettings({ reps: 1 });

  // 28. no shots heard: no clock running up to maxWait ("9.98"), a dash and what to check instead
  let shown = [];
  const watchBig = setInterval(() => shown.push($("big").textContent), 30);
  await runSet("drill, no shots", { mode: "drill", pattern: "P" }, () => []);
  clearInterval(watchBig);
  check("no shots: no running clock", !shown.some(t => /^[1-9]\.\d\d$/.test(t)), [...new Set(shown)].join(","));
  check("no shots: a dash and the threshold hint", $("big").textContent === "—" && statusText === "No shots" && /threshold/.test($("hint").textContent), `${$("big").textContent} | ${statusText} | ${$("hint").textContent}`);
  check("no shots: spoken", SAID.includes("No shots detected. Check the microphone threshold."), SAID.slice(-1)[0]);
  await runSet("course, deaf mic", { mode: "course" }, () => "deaf");
  check("deaf mic: says neither beep nor shot was heard", statusText === "No shots" && /neither the beep nor a shot/.test($("hint").textContent), $("hint").textContent);

  // 29. a suspended audio clock asks for a tap, and the status comes back when it runs again
  setup({ mode: "drill", pattern: "P1", maxWait: 3 }); SAID.length = 0; rep = 0; PLAN = () => [];
  startSession(); await until(() => string && string.live, 30000);
  ctx.state = "interrupted"; onAudioState();
  check("audio paused: asks for a tap", statusText === "Audio paused" && /Tap anywhere/.test($("hint").textContent) && string.audioGap, statusText);
  ctx.state = "running"; onAudioState();
  check("audio running again: status back", statusText === "Listening", statusText);
  await until(() => state === "idle", 30000);
  check("audio gap noted in the result", /Audio paused during the string/.test($("hint").textContent), $("hint").textContent);

  // 30. the real detector (worklet and filters) on synthesized audio: a quiet beep under a high shot threshold
  // is still heard, by its tone; loud broadband shots are shots, and never pass for the beep
  {
    const sr = 48000, len = 2.5, ac = new OfflineAudioContext(1, sr * len, sr);
    await ac.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" })));
    const buf = ac.createBuffer(1, sr * len, sr), x = buf.getChannelData(0);
    let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let i = 0; i < x.length; i++) x[i] = 0.003 * rnd();                       // the room, about -50 dB
    const beepAt0 = 1.0, shotsAt = [0.5, 1.12, 2.0];
    for (let i = 0; i < 0.3 * sr; i++) x[Math.round(beepAt0 * sr) + i] += 0.03 * Math.min(1, i / (0.005 * sr)) * Math.sin(2 * Math.PI * BEEP_HZ * i / sr);   // -30 dB
    for (const at of shotsAt) for (let i = 0; i < 0.05 * sr; i++) x[Math.round(at * sr) + i] += 0.6 * Math.exp(-i / (0.008 * sr)) * rnd();
    const src = ac.createBufferSource(); src.buffer = buf;
    const { detector: node } = wireDetector(ac, src);
    node.connect(ac.destination);
    node.port.postMessage({ threshold: dbToAmp(-15), refractory: 0.08 });
    const got = { hit: [], beep: [] };
    node.port.onmessage = e => { if (e.data.hit != null) got.hit.push(e.data.hit); if (e.data.beep != null) got.beep.push(e.data.beep); };
    src.start(0);
    await ac.startRendering(); await sleep(300);
    check("detector: quiet beep heard under a high shot threshold", got.beep.length === 1 && Math.abs(got.beep[0] - beepAt0) < 0.004, JSON.stringify(got.beep));
    check("detector: shots are shots, not beeps", got.hit.length === 3 && shotsAt.every((at, k) => Math.abs(got.hit[k] - at) < 0.004), JSON.stringify(got.hit));
  }

  // 14. generated course + score over 12 shots prompt uses digits
  check("numWord 15", numWord(15) === "15");
  check("no errors", !LOG.some(l => l.startsWith("ERROR") || l.startsWith("REJECT")));
  } catch (e) { LOG.push("EXC " + e.stack); }
  done();
})();
