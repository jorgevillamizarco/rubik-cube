# Rubik's Cube — Agent Pipeline Run Summary

## Run: 2026-06-23 — Fix solve algorithm (3 bugs)

### Bugs Fixed (3/3 PASS — verified with Puppeteer headless Chrome)

| # | Bug | Description | Root Cause | Fix | Status |
|---|-----|-------------|------------|-----|--------|
| 1 | Solve button does nothing | Clicking Solve freezes the browser — Kociemba solver blocks main thread indefinitely | `getSolverFacelets()` read U and L faces front-to-back (z=+1→z=-1) but cubejs expects back-to-front (z=-1→z=+1). Produced invalid cube state (correct color counts, impossible cubie permutation). Solver searched forever for non-existent solution. | Reversed coordinate order for U and L faces in `getSolverFacelets()` | PASS |
| 2 | Solver error after animation | Solver returns valid solution, cube animates through all moves, but `checkSolved()` fails → "Solver error" | `parseMove()` used `sign = -1` for ALL faces. Correct for positive-axis faces (R=+x, U=+y, F=+z) but wrong for negative-axis faces (L=-x, D=-y, B=-z). L/D/B moves turned the wrong direction. | Changed to `sign = a.l > 0 ? -1 : 1` — positive-axis faces use -π/2, negative-axis faces use +π/2 | PASS |
| 3 | checkSolved() false negative | After solver correctly solves cube (facelets all match solved state), `checkSolved()` returns false → "Solver error" | `checkSolved()` used `Euler.setFromQuaternion()` to verify cubie orientations at 90° increments. 62 of 64 valid cube orientations fail this check due to gimbal-lock in Euler decomposition. | Replaced Euler decomposition with quaternion dot-product approach: compute max \|q·candidate\| over 64 candidate quaternions; pass if \|bestDot - 1\| < 0.01 | PASS |

### Verification

**Method:** Node.js simulation matching browser logic + Puppeteer headless Chrome (3 test scrambles)

- ✅ All 18 basic moves (R, R', R2, L, L', ... B2) produce facelet strings exactly matching cubejs
- ✅ 5 compound move sequences match cubejs
- ✅ 3 different 20-move scrambles → autoSolve → all solved ("Solved! 🎉")
- ✅ Facelet strings match solved state after solve animation

### Files Changed

- `index.html` — 3 fixes:
  - `getSolverFacelets()`: reversed U and L face coordinate order (lines ~510, ~515)
  - `parseMove()`: `sign = a.l > 0 ? -1 : 1` instead of hardcoded `sign = -1` (line ~415)
  - `checkSolved()`: quaternion dot-product instead of Euler decomposition (lines ~534-549)

---

## Previous Run: 2026-06-12 — Fix 5 bugs (Kanban pipeline)

### Bugs Fixed (5/5 PASS)

| Bug | Description | Status | Evidence |
|-----|-------------|--------|----------|
| 1. Scramble visual | Euler-angle quaternion snap replaced with 64-candidate dot-product approach | PASS | No '?' in facelets (54 chars), scramble renders correctly |
| 2. Drag interaction | OrbitControls disabled early when shiftKey pressed | PASS | Shift+drag produces face turn, regular drag rotates camera |
| 3. Move counter | STATE.moves derived from STATE.history.length | PASS | Counter stays synchronized across scramble, manual turns, solve, reset |
| 4. Solve button | Silent guard replaced with "Already solved! 🎉" message | PASS | Solve on solved cube shows message; no silent no-op |
| 5. dragLastPos | Reset to null in onPointerUp | PASS | No ghost drag interactions across pointer sequences |

### Notes
- Full solve animation could not be tested in prior run due to Kociemba solver crashing headless Chrome (main thread blocked). Root cause found in this run: invalid facelet string from reversed U/L face reading order.