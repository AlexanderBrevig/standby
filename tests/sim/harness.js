// Simulation harness for tests/run.sh: loaded into a copy of index.html after its own script.
// stubs: clock, audio, speech; scripted voice replies keyed on the last prompt
const LOG = [], SAID = [];
window.onerror = (m, s, l) => LOG.push("ERROR " + m + " @" + l);
window.onunhandledrejection = e => LOG.push("REJECT " + (e.reason && e.reason.stack || e.reason));
ctx = { get currentTime() { return performance.now() / 1000; }, outputLatency: 0, baseLatency: 0 };
const beeps = [];
beepAt = (t, dur) => { const g = { t, dur, cancelled: false, disconnect() { this.cancelled = true; } }; beeps.push(g); return g; };
endTone = () => sleep(10);
openMic = async () => {}; closeMic = () => {};
speak = async t => { SAID.push(t); await sleep(250); };
let REPLIES = [];   // [regex on last prompt, reply] (each used once)
listen = (onText, onFinal) => {
  if (!canListen()) return () => {};
  const last = SAID[SAID.length - 1] || "";
  const i = REPLIES.findIndex(([re]) => re.test(last));
  if (i < 0) return () => {};
  const reply = REPLIES.splice(i, 1)[0][1];
  const id = setTimeout(() => { onText(reply); onFinal && onFinal([reply]); }, 400);
  return () => clearTimeout(id);
};
// shoot: when a string is armed, the mic hears the beep 50 ms after T, then shots at the given times from it
let PLAN = () => [];
let rep = 0;
setInterval(() => {
  const s = string;
  if (s && !s.fed) {
    s.fed = true; const shots = PLAN(s, rep++);
    if (shots === "early") { onHit(ctx.currentTime + 0.05); return; }
    const heard = s.T + 0.05;
    setTimeout(() => onBeep(heard), (heard - ctx.currentTime) * 1000);
    for (const x of shots) setTimeout(() => onHit(heard + x), (heard + x - ctx.currentTime) * 1000);
  }
}, 20);
const until = async (cond, ms = 60000) => { const end = performance.now() + ms; while (!cond() && performance.now() < end) await sleep(20); return cond(); };
const base = { confirm: false, readyWindow: 0, prepTime: 0.2, delayMin: 0.5, delayMax: 0.5, repInterval: 2, silence: 2, maxWait: 3,
  score: false, closing: false, parMode: "off", speakResults: true, startPos: "holster", voice: true, reps: 1, };
function setup(opts) { Object.assign(S, base, opts); refreshDrillUi(); }
const lastLog = () => load("standby.log", [])[0];
async function runSet(name, opts, plan, replies = []) {
  setup(opts); PLAN = plan; rep = 0; REPLIES = replies; SAID.length = 0;
  startSession();
  const ok = await until(() => state === "idle");
  LOG.push(`== ${name}${ok ? "" : " (TIMED OUT, state " + state + ")"}`);
}
function done() { document.body.insertAdjacentHTML("beforeend", `<pre id="out">${LOG.join("\n")}</pre>`); }
document.getElementById("overlay")?.remove(); state = "idle"; gestured = true; localStorage.removeItem("standby.log"); localStorage.removeItem("standby.par"); parCache = null;
