# TODO

Feature ideas, roughly by priority. Sport framing only (IPSC / Steel Challenge); see docs/drills-design.md for what exists.

## Next up

- **Voice configuration**: done (hands-free setup, see README). Later: chain named setups into a guided session (below).
- **Guided session with a safety check-in and check-out.** a short, user-written safety checklist read out and confirmed ("Say checked") Then blocks (cold benchmark rep, warm-up without par, 2–3 drill blocks), and a deliberate close ("Session complete.") The app won't start again without a new check-in. Self-reported, but it builds the habit.
- **Judge the process.** Pick 1–2 focus cues ("finger out before I move", "come up from below"). The briefing speaks them, and after each rep the app asks "Finger out? Yes or no." Optional shot calling: say the call before looking, then score, and log call accuracy. Per set, show a process score ("finger out 9/10, calls 7/10").
- **Benchmarks, progress view, export/import.** A fixed suite (Draw `P1`, Doubles `P`, Bill `P6`, Blake `3P`, Reload `P1 R P1`, El Presidente). The first rep of the day is tagged *cold*, then best of 3–5. Tag runs by setup (gun, distance, phone position). Show this month vs last month (median, best), with no fixed "good" numbers. **Export/import JSON/CSV**, because the log lives only in localStorage.

## Worth knowing (IPSC rookie)

- **Guns that don't cycle.** With a gun that has to be racked between shots, `P`, `P6` and Bill splits are really rack times. An optional "rack between shots" setting could label those gaps "reset" instead of "split" and keep a separate par.
- **Full IPSC penalties in spoken scoring.** Add the words "no-shoot" (−10, max 2 per no-shoot target, 9.4.2–9.4.3) and "procedural" (−10, 10.2). "Failure to engage" (9.5.6, 10.2.7) when there are fewer shots than targets. Allow a "paper with no-shoot" in generated courses.
- **Hit-factor trade-off feedback.** "That charlie cost 2 points, about 0.4 s at hit factor 5." Teaches when to take the C and when to slow down.
- **Stage mode.** A written briefing in the 3.2.1 format (targets, minimum rounds, ready condition, start position, procedure). Then a walkthrough timer where you speak your verbal plan ("two left, step, steel, reload…"). Recognition shows it as the mnemonic. Then one run, full scoring, plan vs actual. Production realism: a magazine capacity setting (15, D4 18.2) and course size (short / medium / long = 12 / 24 / 32 rounds, 1.2.1). Reject plans with more than 15 shots between reloads, and warn when no spare is left for a make-up shot. During a real walkthrough you may rehearse only with your hands (8.7.2).
- **Random "Stop!" command.** Rarely, mid-string, the app says "Stop!" (8.3.5). A click more than ~0.3–0.5 s later is flagged "shot after Stop". Optional and rare.
- **Steel Challenge mode.** A `5S` array (stop plate last) shot 5 times, worst run dropped and the rest summed (Outer Limits: 4 runs, best 3). User arrays named after the 8 official stages, for long-term comparison.
- **Strong hand / weak hand only.** "Weak hand only from the second target" (1.1.5.3). A weak-hand draw isn't allowed (8.2.4), so it's a strong-hand draw plus a transfer, which gets its own "transfer" gap label and par. Score "procedural" for using the other hand (10.2.8). Briefing reminder: finger out during the transfer (a discharge then is a DQ, 10.4.5).
- **Match-realistic closing.** After "If clear, hammer down, holster", expect the single hammer-down click (8.3.7.1) and confirm "Range is clear" only after it. Otherwise prompt "Hammer down?". In realism mode, flag any click between "Make ready" and the beep (dry firing before the start signal = warning, then procedural, 8.7.1).
- **More start positions and ready conditions.** Wrists above shoulders, facing uprange (turn with the gun holstered), seated. Ready conditions: loaded, chamber empty (rack after the draw, 8.1.3), magazine well empty (load from the table). These give new first-gap labels such as "rack" and "load". At home "load" always means an empty mag or a dummy round.
- **Positions in movement.** `M` with a target position (`M:kneel`, `M:port`, `M:3` steps). Spoken in the briefing, with par per position type. Pair it with the focus cue "finger out while moving" (8.5.1.2, 10.5.11).
- **Start-signal reaction drill.** On target from low ready, random 1–4 s delay. Measure beep to click, drop the worst, track the median. A 2-minute warm-up block, not a goal.

Left out on purpose: malfunction drills (can't be induced or detected), creeping (movement, not sound), automatic hit scoring (needs a camera or laser system).

## Experiments (need real-world testing first)

- **Mic shroud for the phone (3D printed).** A cap over the bottom mic (foam plus a small port, or a sealed cavity with a tiny leak) that takes ~20–30 dB off, so loud shots don't overload the mic (phone MEMS mics overload around 120–130 dB SPL; overload doesn't hide a shot's onset, but the ringing can merge close shots). Would make pocket or belt carry more practical. Questions: which mic the browser records from (phones have several), keeping the speaker uncovered so the beep is still heard, and how the result looks in the mic sheet. Likely needs a software "pocket mode" too: a high-pass filter against fabric rustle and a longer echo window.
- **Bluetooth ear protection.** Commands and beep in the ears is attractive, but timing depends on the phone's mic hearing the beep (that's how speaker and mic delay cancel out). With the beep in the ear pro the mic doesn't hear it, and Bluetooth adds ~100–300 ms of variable delay. Options to try: trust `AudioContext.outputLatency` where the device reports Bluetooth delay; a one-off "Bluetooth delay" measurement in the mic setup; or keep the beep on the phone speaker and send only voice to the headset (browser support for splitting outputs is thin). A Bluetooth headset mic is fine for voice commands but poor for shot detection (call-mode compression and gain control smear onsets).
