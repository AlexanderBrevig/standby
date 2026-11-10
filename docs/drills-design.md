# Drills: design

Status: implemented in `index.html`. Decisions made during implementation are noted inline and under "Decided" at the end.

Standby today has one mode: an open string that ends after silence, followed by the closing range commands. This adds **drills**: strings with a known shape, so the app knows how many shots to expect, what each gap between shots means, and when the string is over. On top of that it adds spoken scoring (hit factor), called patterns and adaptive par.

Language: IPSC / sport terms only (targets, paper, steel, arrays, hit factor). No self-defence framing in UI text, voice prompts, presets or docs.

## 1. Pattern grammar

A pattern is a sequence of tokens separated by spaces (case-insensitive):

| Token | Meaning | Shots |
|---|---|---|
| `P` | paper target | 2 |
| `S` | steel (popper / plate) | 1 |
| `xP`, `xS` | x targets in a row: `3P` = `P P P`, `5S` = five plates | x × default |
| `Pn`, `xPn` | n shots per paper: `P1` (one shot), `P6` (Bill drill), `3P1` (three papers, one shot each) | x × n |
| `R` | reload | 0 |
| `M` | movement / position change | 0 |

Prefix = number of targets, suffix = shots per paper. Why have a suffix at all: IPSC scores the best two hits per paper by default, so 2 is the right default. IPSC scoring is Comstock only (rule 9.2.1: unlimited shots, a *stipulated number of hits* per target scores). Rule 9.5.1 makes "best two hits" the default "unless otherwise specified in the written stage briefing", so a stage may stipulate one or three scoring hits per paper. It can't cap the shots fired (8.1.4; a fixed round count, "Virginia Count", is USPSA, not IPSC). So `P1` / `P3` mean the number of hits that score, which in dry fire is the number of shots you plan to fire. Drills like the Bill drill put more than two on one paper. Generated reloads always fall between two targets, which matches rule 1.1.5.2 for mandatory reloads (after the first target, before the last). Steel takes no suffix: it must fall (one hit). Steel takes no suffix: one hit.

Rules: at least one target. `R` and `M` only between targets, never first or last, never two in a row. `x` and `n` are 1–12. `xP` expands to x separate targets, so the gaps between them are transitions. An invalid pattern disables Start and shows the error inline.

Parsing produces a list of shots, each with the label of the gap *before* it:

| Gap | When |
|---|---|
| `draw` | beep → first shot |
| `split` | between shots on the same target |
| `transition` | target → next target, with no `R`/`M` between (subtype kept: `P→P`, `P→S`, `S→P`, `S→S`) |
| `reload` | across an `R` (last shot before → first shot after) |
| `movement` | across an `M` |

Example: `P S R P` → 5 shots: `draw, split, transition(P→S), reload, split`.

Transitions are **stored with their subtype**. The spoken summary and the main screen use a single averaged "transition" figure. The log and stats can break it down by subtype later.

### Presets

| Name | Pattern |
|---|---|
| Draw | `P1` |
| Doubles | `P` |
| Paper–steel | `P S` |
| Blake | `3P` |
| Bill drill | `P6` |
| One per paper | `3P1` |
| Reload | `P R P` |
| El Presidente | `3P R 3P` |
| Steel five | `5S` |
| Custom… | free text |

## 2. Modes

A single **Mode** selector:

- **Course**: the current behaviour, unchanged. No pattern; the string ends on silence and the closing commands run. Scoring can be turned on (it uses the detected shot count).
- **Drill**: a fixed pattern (preset or custom).
- **Called**: each rep picks a pattern at random from a pool and briefs it with the start command every rep.

Drill and Called share everything below. They differ only in where the pattern comes from.

### Start position

A **Start** dropdown, separate from the pattern, applies in every mode: Holster (default), Low ready, Table, Random.

- It names the first gap: `draw` (holster), `first shot` (low ready), `pickup` (table).
- Adaptive par is kept per pattern **and** start: the key is `P S` for holster (unchanged) and `P S @ready` / `P S @table` otherwise. A draw and a shot from ready differ by several tenths, so they mustn't share a par.
- **Briefing:** the start command comes with the course of fire: "From table. Paper, paper, steel. Make ready." / "Paper, paper, steel. Load and make ready." (holster isn't named unless the start is random). Called mode briefs every rep, since the pattern changes. **Confirmation** (setting, on by default): the briefing ends with "Say continue to proceed." and waits, however long, for "continue" / "proceed" / "go ahead" or the Continue button (the Start button relabelled) before the start command. "Repeat" reads it again. "Next" / "skip" drops it and briefs another (a new pattern in Called mode). Listening only starts after the announcer has finished, so its own "continue" isn't heard as the answer. No briefing (Course from the holster) means no confirmation. **Display:** while the briefing waits and until the beep, the status line shows the briefing text and the big display shows the course mnemonic: start letter (H holster, L low ready, T table), then every target (`P`, `S`, `P1` for a non-default count), `R` reload, `M` movement. "From table, paper, steel, paper" → `T P S P`. It is shrunk to fit one line (container query units) and replaced by the timer at the beep. (An earlier version called the pattern after "Are you ready?", just before "Standby"; that was too late and too easy to miss, so it moved into the briefing.) The start command setting is Automatic by default ("Make ready" for a table start, "Load and make ready" otherwise). Make ready / Load and make ready remain as fixed overrides, but a table start always says "Make ready". A saved "Make ready", the old default, migrates to Automatic.
- Random picks a start per rep, and every rep gets the full start command for it ("Load and make ready. Holster.", "Make ready. Gun on the table."), with the make-ready time to change position. The set summary then skips totals, since they don't compare.

## 3. Drill string flow

```
[rep 1; every rep with a random start or in Called mode] ["From table."] ["Paper, paper, steel."] "Say continue to proceed." → (wait for "continue") → Make ready → (prep time)
Are you ready? → (not-ready window)
Standby → random delay → BEEP
shots…   (labelled live: "draw 0.98 · split 0.24 · transition 0.31")
Nth shot → grace window → END TONE
[scoring on] "Score?" → listen → readback
spoken summary (time, HF, par result)
[reps left] "Next in 5" → Are you ready? …   [last rep] set summary
```

- **End on count.** After the Nth expected shot, wait a short **grace window** (0.6 s, longer when the pattern has a reload, see §4). Then the detector closes and the **end tone** plays: two short low beeps, distinct from the start beep. Closing the detector first means our own tone and the shooter's voice are never counted as shots.
- **Too few shots:** if fewer than N peaks arrive, the string ends on the existing silence timeout. The summary says "4 of 5 shots heard". The rep is logged as incomplete and is not scored. It leaves adaptive par unchanged: a click the mic missed is not the shooter's fault.
- **Extra shots** inside the grace window are resolved by §4 and flagged ("1 extra sound ignored").
- **No closing commands** in Drill/Called mode. The gun isn't being unloaded between reps. The session as a whole still starts with Make ready.
- **Reps:** set size N (default 1 = single string) and rep interval (default 5 s). Saying "stop" or "hold" at any point pauses the set. "Restart" resumes it.
- **Restart:** the Start button is always clickable. While a string runs it reads **Restart**: the current rep is dropped and a new one starts at once (Called mode draws a new pattern, a set keeps its place). During the briefing it reads **Continue**.

## 4. Extra sounds and reloads

Seating the magazine, a magazine hitting the floor and the slide release all produce peaks that can pass the threshold. These sounds fall *inside* the reload gap, mostly near its end (seating the mag happens just before the next shot), so a dead zone after the last shot can't remove them.

Approach: **collect every peak and decide afterwards which ones were shots.**

- With an `R` in the pattern, the string doesn't end the moment the count is reached. It ends once the count is reached **and** 1.0 s of silence has passed, so late shots still get in.
- **Resolution:** given P peaks (P ≥ N) and the pattern, choose the N peaks, in order, that minimise the draw time plus the `split` and `transition` gaps. `reload` and `movement` gaps are free, with a small reward for being long (−0.05 × gap) so that a single shot after a reload isn't matched to the noise just before it. A reload noise picked as a shot would either stretch a split or shrink the reload into a split-sized gap, so the true shots win. This is a small ordered-subset DP (O(N·P²), P is small) and runs once at string end.
- With no `R`/`M`, the same resolution handles a stray echo in the grace window.
- The live display shows raw peaks during the string. The summary and log show the resolved shots.

Needs a test with a real gun: how loud is mag seating compared with the dry-fire click? If it's routinely louder, an extra option could raise the threshold during the expected reload gap.

## 5. Spoken scoring

Optional (setting **Score after string**: off / on). After the end tone (Drill/Called) or after "Range is clear" (Course):

1. Say **"Score?"** and listen. The window is 5 s, extended by 1.5 s after each interim recognition result, so a long phrase isn't cut off.
2. The shooter says **one word per shot**, in any order:
   - `alpha` 5, `charlie` 3 (major 4), `delta` 1 (major 2), `mike` −10
   - A steel hit is said as **alpha** (a fallen popper or plate scores 5). A steel miss is **mike**.
   - Shortcut: **"all alpha"**.
3. **Word count must equal the shot count** (resolved shots in Drill/Called, detected shots in Course). On a mismatch: "Heard four, expected five. Say again." This allows one retry, then the rep is logged unscored.
4. **Readback:** "Alpha alpha alpha charlie mike. Eight points. Two point one zero. Hit factor three point eight one." Saying "correction" within 3 s reopens the window.

Calculation: `points = max(0, Σ word values)` (an IPSC stage score floors at 0). `HF = points / total time`.

**Parsing** is fuzzy and token-based, applied to every recognition alternative (the existing `listen()` already passes all of them):
- `alpha|alfa|alpha's|elfa|alva` → A, `charlie|charley|charly` → C, `delta|delt` → D, `mike|mic|mic's|like` → M
- Plurals and punctuation stripped. Unknown tokens are ignored, so "uh, alpha alpha" still works.
- The first alternative that gives a valid count wins.

**Tap fallback:** during the window, an `A C D M` button row with an undo button is shown. It submits automatically once N taps are reached. This always works, including without speech recognition.

Settings: **Power factor** minor / major.

## 6. Called patterns

- **Pool:** a list of patterns, one per line or separated by `|`. Default: `2S | P S | 2P | 2P S` (2, 3, 4 and 5 shots, all distinct, so a wrong pattern is always caught by the count).
- Each rep picks a random entry, avoiding the same one twice in a row.
- It's announced in the briefing, before the start command, every rep: targets read one by one ("paper, steel, reload, paper"; `3P` → "paper, paper, paper", `5S` → "five steel" (runs over three are grouped), `P1` → "paper, one shot", `3P1` → "paper, paper, paper, one shot each").
- **Distinct counts:** the app can only check the shot count, not the order. If two pool entries have the same total, the editor warns that a wrong pattern of the same count can't be detected. This is allowed, but flagged.
- If the shots heard ≠ the called count, the rep fails ("Called three, heard two").

### Generated courses ("My targets")

Called mode can take its patterns from the **pool** or from **My targets**: what's set up on the range, e.g. `5P 3S`.

- Each course uses a random selection of those targets, each at most once, in random order. Its length is between **Targets per course** min and max (default 3–6, capped at what's available), so a lone `P` (better done in Drill mode) doesn't come up.
- **Reload chance** (default 20 %): the chance that a course gets one reload, placed at a random point between two targets.
- The same course never comes twice in a row.
- Adaptive par is off for generated courses. Par is kept per pattern and generated courses rarely repeat, so it would stay in calibration. Fixed par works.

The default pool is larger (12 patterns, one per line) to show what patterns can do: `P S`, `P S P`, `S P S P`, `2P S`, `P 2S P`, `3S P`, `4P`, `2P S 2P`, `P S R P S`, `2P R 2P`, `S 3P S`, `P1 P1 S S`. Many share a shot count, so the editor's note about it is informational, not an error. A saved pool equal to the old 4-pattern default migrates to the new one.

## 7. Par: off / fixed / adaptive

**Fixed:** the existing par beep, now per drill.

**Adaptive** (staircase, 2-down / 1-up, which settles at about 71 % success):
- **Pass** = all N shots before par **and** (when scored) no mikes. An unscored rep is judged on time alone.
- After 2 passes in a row: par −step. After 1 fail: par +step. Step 0.05 s by default, with a floor of 0.30 s.
- **State per pattern** (normalised pattern string) in `localStorage["standby.par"]`: `{ par, passStreak, history: [{at, par, pass}] }`. In Called mode, each pattern in the pool keeps its own par.
- **Start:** with no stored par, the first 3 reps run without a par beep. Par then starts at their mean total × 1.10, rounded to 0.05.
- The summary says "Inside par. Next par 2.35" / "Over par. Next par 2.45". A sparkline of par over the set shows on screen.

**Fix needed in the existing par-beep mask:** `onHit` currently drops *every* peak from −0.02 to +0.28 s around the par time. With adaptive par, real shots cluster right at par and would be lost. Change it to work like beep onset detection: the first peak in that window is taken as the par beep, and later ones count as shots.

## 8. Log and stats

A log entry adds: `mode, pattern, labels[], score words, points, hf, par, pass, resolvedExtras`. Old entries without these fields still render.

Table columns: Time · Pattern · Total · HF · Par. Tapping a row shows each shot with its gap label. Set summary (spoken, and shown on screen): reps, best/average total, best/average HF, average split, average transition, average reload, final par.

## 9. Settings changes

Grouped in the Settings card:
- **Drill:** Mode, Start, Pattern (preset + text), Pool (Called), Reps, Rep interval
- **Par:** Off / Fixed (value) / Adaptive (step), with a "Reset adaptive par" button
- **Scoring:** Score after string, Power factor
- Existing timing/detector settings unchanged. "End after silence" applies to Course mode and to incomplete drill strings.

## 10. Build order

1. **Pattern engine:** parser, labels, presets, Drill mode with end on count, end tone, gap labels shown live and in the summary, resolution DP, log fields. Fix the par-beep mask.
2. **Scoring:** "Score?" window, parser, readback/correction, tap fallback, HF, power factor.
3. **Reps:** auto-repeat, pause/resume, set summary.
4. **Called mode:** pool, announcement, count check.
5. **Adaptive par:** staircase, per-pattern state, calibration reps, sparkline.

Each step can ship on its own. Course mode keeps working throughout.

## Decided

- **Make ready** is said at the start of a session and again after a paused set resumes, not before every rep.
- **All alpha readback:** "All alpha. 25 points." Any other score is read back word by word.
- **Called mode and reloads:** extra sounds in a called pattern with `R`/`M` are expected (reload noise) and don't count as a wrong shot count. Without `R`/`M`, an extra shot in the grace window does.
- **Correction words:** "correction", "again", "redo", "wrong". Not "correct", which can mean yes.
- **Too few shots** leave adaptive par unchanged, in every mode (the mic may have missed a click). An extra shot in a called pattern without `R`/`M` fails the rep.

## Open

- Reload noise in practice: is the DP enough, or do we also need a reload-gap threshold boost? (test with real gear)
