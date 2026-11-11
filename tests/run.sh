#!/usr/bin/env bash
# Runs the in-page self test (index.html?selftest) and the simulated end-to-end cases (tests/sim)
# in headless Chrome. Exits non-zero on any failure. Usage: tests/run.sh   (CHROME=/path/to/chrome to override)
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
chrome=${CHROME:-$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)}
[ -n "$chrome" ] || { echo "Chrome not found; set CHROME=/path/to/chrome" >&2; exit 2; }
flags=(--headless=new --disable-gpu --allow-file-access-from-files)
[ -n "${CI:-}" ] && flags+=(--no-sandbox)
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
status=0

# Virtual time makes the timers (speech pauses, rep intervals) run instantly.
page() { "$chrome" "${flags[@]}" --virtual-time-budget="$2" --dump-dom "$1" 2>>"$work/chrome.err"; }

echo "== self test"
out=$(page "file://$root/index.html?selftest" 5000 | sed -n '/<pre id="selftest"/,/<\/pre>/p' | sed 's/<[^>]*>//g')
echo "$out" | grep -E "passed|FAIL"
echo "$out" | grep -q "^all passed" || status=1

echo "== simulation"
cp "$root/index.html" "$root/tests/sim/harness.js" "$root/tests/sim/cases.js" "$work/"
sed -i 's#</body>#<script src="harness.js"></script><script src="cases.js"></script></body>#' "$work/index.html"
out=$(page "file://$work/index.html" 900000 | sed -n '/<pre id="out">/,/<\/pre>/p' | sed 's/<[^>]*>//g')
echo "$out" | grep -E "^(==|FAIL|ERROR|REJECT|EXC)" || true
echo "$(echo "$out" | grep -c '^ok') ok, $(echo "$out" | grep -cE '^(FAIL|ERROR|REJECT|EXC)') failed"
if ! echo "$out" | grep -qx "== done"; then
  echo "INCOMPLETE: the simulation stopped before its end ($("$chrome" --version)). Last lines and Chrome's errors:"
  echo "$out" | tail -3; tail -20 "$work/chrome.err"; status=1
fi
{ [ -n "$out" ] && ! echo "$out" | grep -qE "^(FAIL|ERROR|REJECT|EXC)|TIMED OUT"; } || status=1

[ $status -eq 0 ] && echo "PASS" || echo "FAIL"
exit $status
