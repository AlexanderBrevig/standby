# Standby

IPSC-style range commands, a random start beep and a sound-triggered shot timer for **dry fire**, in one static web page.

**Live:** https://alexanderbrevig.github.io/standby/

## What it does
1. Say **"restart"** (or tap Start) → "Make ready" → pause → "Are you ready?"
2. Say **"not ready"** within the window to hold (silence = ready, like on the range).
3. "Standby" → random 1–4 s → beep.
4. Every sound peak above the threshold is a shot: first-shot time and splits on screen.
5. After 5 s of silence: "If you are finished, unload and show clear". A shot within ~2.5 s after that means you weren't: the string continues (the pause counts in the total, like on a real timer). Otherwise "If clear, hammer down, holster" → "Range is clear", then the results are read out.

Options: par time (second beep), early-start detection (sound before the beep), make-ready time, delay range, echo/min-split window, log of the last strings (stored in the browser only).

## Modes
While a string runs, the page switches to a range view: settings hidden, the status, course and timer as large as the screen allows, so it can be read from a few metres. After the string it shows the verdict (inside/over par, hit factor), the total and every gap.

- **Course**: the flow above. An open string that ends on silence.
- **Drill**: a fixed pattern of targets. It's briefed first ("From table. Paper, paper, steel. Say continue to proceed."). Say "continue" or tap Continue to get the make-ready command; "repeat" reads it again. "Next" gives another challenge. This can be turned off in Settings. Until the beep, the big display shows the course mnemonic for planning, e.g. `T P S P` (table start, paper, steel, paper). The string ends on the last expected shot (two low beeps) with no closing commands, so reps go quickly. Each gap gets a name: draw, split, transition, reload, movement.
- **Called**: each rep picks a random pattern, either from a pool or generated from the targets you have set up ("5P 3S", 3–6 targets per course, sometimes a reload), and briefs it with the start command every rep ("From table. Paper, steel. Make ready.").

Patterns: `P` paper (2 shots), `S` steel (1 hit), `R` reload, `M` movement. The prefix is the number of targets and the suffix is shots per paper: `2P` two papers, `P1` one shot, `3P1` three papers one shot each, `5S` five plates. Presets include Bill drill `P6`, Blake `3P`, Reload `P R P` and El Presidente `3P R 3P`. Reload noise (magazine seating, slide release) is filtered out after the string by choosing the peaks that give the shortest splits and transitions.

**Start position:** Holster, Low ready, Table or Random. It names the first gap (draw, first shot, pickup) and keeps a separate adaptive par. The start command follows it: "Make ready" for a table start, "Load and make ready" otherwise. With Random, every rep gets the full start command for its position.

**Reps:** run a set of N reps with an interval between them. Say "stop" between reps to pause and "restart" to continue. A set summary is read out at the end. The Start button is always live: while a string runs it reads Restart and starts a fresh rep at once.

**Scoring:** after the string, say one word per shot: alpha, charlie, delta, mike (a steel hit is alpha), counts ("three alpha one charlie"), or "all alpha" (also "all alpha except one charlie"). You can also tap the buttons. The number of words must match the number of shots. You get points (minor or major power factor) and hit factor. Say "correction" to score again.

**Adaptive par** (Drill/Called): a staircase per pattern. Two passes in a row take a step off par, one fail adds a step. A pass is every shot inside par with no mike. The first three reps set the starting par. See [docs/drills-design.md](docs/drills-design.md).

## Tips and limits
- **Calibrate with "Mic test"**: set the threshold just above room noise and below your dry-fire click. Phone close to the gun works best.
- **Times are measured from the beep as the mic hears it**, so speaker and microphone latency cancel out.
- **Saying "bang" works, but adds your voice reaction time** (~0.15–0.3 s, inconsistent). Use the trigger/hammer click or an airsoft gun for numbers worth logging.
- Not for live fire: phone mics clip and indoor ranges echo. Buy a real shot timer.
- With a reload in the pattern, check in "Mic test" how loud seating the magazine is compared with your click. The filter assumes the sound comes before the next shot and isn't right on top of it.
- Voice commands use the browser's speech recognition (Chrome: Google's servers, needs a network, ~0.5–1 s lag; Android may chime when it starts listening). Timing never uses it. Without it, use the buttons.
- The screen is kept awake while the page is open (Wake Lock API, where supported).

## Development
Plain HTML/CSS/JS in `index.html`, no build step. The shot detector is an AudioWorklet (inline, sample-accurate timestamps on the same clock as the scheduled beep). The beeps are sine tones, notched out of the shot input and picked up on a second band-passed input, so shots during a beep still count and the beep's arrival is measured. Serve over HTTPS or `localhost` (microphone access requires a secure context).

**Tests:** `tests/run.sh` runs the in-page self test (open `index.html?selftest` to see it) and simulated end-to-end runs (`tests/sim/`: stubbed mic, voice and clock, with scripted shots and replies) in headless Chrome, in about two seconds. CI runs the same script on every push (`.github/workflows/test.yml`). Ideas and next steps: [TODO.md](TODO.md).
