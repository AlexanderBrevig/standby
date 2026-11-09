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

## Tips and limits
- **Calibrate with "Mic test"**: set the threshold just above room noise and below your dry-fire click. Phone close to the gun works best.
- **Times are measured from the beep as the mic hears it**, so speaker and microphone latency cancel out.
- **Saying "bang" works, but adds your voice reaction time** (~0.15–0.3 s, inconsistent). Use the trigger/hammer click or an airsoft gun for numbers worth logging.
- Not for live fire: phone mics clip and indoor ranges echo. Buy a real shot timer.
- Voice commands use the browser's speech recognition (Chrome: Google's servers, needs a network, ~0.5–1 s lag; Android may chime when it starts listening). Timing never uses it. Without it, use the buttons.
- The screen is kept awake while the page is open (Wake Lock API, where supported).

## Development
Plain HTML/CSS/JS in `index.html`, no build step. The shot detector is an AudioWorklet (inline, sample-accurate timestamps on the same clock as the scheduled beep). Serve over HTTPS or `localhost` (microphone access requires a secure context).
