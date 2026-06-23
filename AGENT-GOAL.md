# Rubik's Cube — Agent Run Summary

## Run: 2026-06-23 — Fix solve algorithm + drag interaction (7 bugs total)

### Solve Algorithm (3 bugs — all PASS)

| # | Bug | Root Cause | Fix |
|---|-----|------------|-----|
| 1 | Solve button freezes browser | `getSolverFacelets()` read U and L faces front-to-back but cubejs expects back-to-front. Produced invalid cube state → solver searched forever, blocking main thread. | Reversed U and L face coordinate order |
| 2 | Solver error after animation | `parseMove()` used `sign = -1` for ALL faces. Wrong for negative-axis faces (L/D/B). | `sign = a.l > 0 ? -1 : 1` |
| 3 | checkSolved() false negative | Euler decomposition fails for 62/64 valid cube orientations due to gimbal-lock. | Replaced with quaternion dot-product against 64 candidate orientations |

### Drag Interaction (4 bugs — all PASS)

| # | Bug | Root Cause | Fix |
|---|-----|------------|-----|
| 4 | Wrong rotation axis for drag | Hardcoded axis mapping per face was wrong (e.g., right face Y-drag → Y-axis instead of Z-axis). | Replaced with cross product: `axis = faceNormal × dragDirection` |
| 5 | Wrong rotation layer | Used clicked face's normal-axis layer instead of cubie position along rotation axis. | `dragLayer = Math.round(dragCubie.userData.grid[axis])` |
| 6 | Vertical drag direction inverted | Screen pixel Y goes down, NDC Y goes up — not accounted for. | Negate `screenDy` when projecting onto NDC tangents |
| 7 | Notation from wrong face | Always used clicked face name (front drag → F/F'), but should derive from rotation axis+layer. | Map axis+layer to face letter: x→R/L, y→U/D, z→F/B |

### Verification (Puppeteer headless Chrome)

**Solve algorithm:**
- ✅ All 18 basic moves produce facelet strings exactly matching cubejs
- ✅ 5 compound move sequences match cubejs
- ✅ 3 different 20-move scrambles → autoSolve → all "Solved! 🎉"

**Drag interaction:**
- ✅ Right face drag up → R, drag down → R'
- ✅ Front corner drag up → L', drag down → L
- ✅ Up face drag right → U', drag left → U
- ✅ 5 drag-scrambled moves → autoSolve → "Solved! 🎉"

### Commits
- `033dd46` — Fix solve algorithm: facelet order (U/L), move direction (L/D/B), checkSolved gimbal-lock
- `340b748` — Fix Shift+drag face-turn: cross-product axis detection, corrected layer, screen Y inversion

---

## Previous Run: 2026-06-12 — Fix 5 bugs (Kanban pipeline)

| Bug | Description | Status |
|-----|-------------|--------|
| 1. Scramble visual | Euler-angle quaternion snap replaced with 64-candidate dot-product approach | PASS |
| 2. Drag interaction | OrbitControls disabled early when shiftKey pressed | PASS |
| 3. Move counter | STATE.moves derived from STATE.history.length | PASS |
| 4. Solve button | Silent guard replaced with "Already solved! 🎉" message | PASS |
| 5. dragLastPos | Reset to null in onPointerUp | PASS |