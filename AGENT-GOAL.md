# Rubik's Cube — Agent Run Summary

## Run: 2026-06-23 (Run 2) — Shift-free dragging, Middle layer turns, and Web Worker Solver

### Improvements & Refactoring

| Feature / Fix | Description | Root Cause / Rationale | Fix |
|---|-----|------------|-----|
| 1. Shift-Free Layer Dragging | Users can turn layers by dragging directly on the cube. No `Shift` key required. | Old code required holding `Shift` to distinguish between camera rotation and layer turns. | Raycast on pointerdown: if it intersects the cube, disable OrbitControls and turn the layer; otherwise, let camera rotate. |
| 2. Middle Layer turns (M, E, S) | Enabled twists on middle rows/columns (layer `0`). | Middle layer turns were hard-blocked previously. | Removed guard in `onPointerMove`. Added support for `M`, `E`, and `S` layers (layer coordinate `0`) in `parseMove` and internal notation. |
| 3. Dynamic Center Mapping | The auto-solver successfully solves the cube even with middle-layer scrambles. | twist on middle layers rotates centers. Solver expects fixed centers. | Added `getDynamicFaceletColorMap` to map facelets dynamically relative to physical center colors on each face. |
| 4. Solve Orientation snapped | Snapped state returns solved regardless of absolute spatial orientation. | `checkSolved()` required absolute coordinates, failing if centers rotated. | Removed absolute coordinate constraint from `checkSolved()` in favor of snapped rotations and solid face colors. |
| 5. Web Worker Solver | Heavy Kociemba solver offloaded to background Web Worker thread. | Solving blocked main thread, causing browser freezes and E2E test crashes. | Wrapped solver scripts into a dynamic Blob Worker. Main thread stays fully responsive. |
| 6. E2E Solve Verification | Playwright tests now verify the full solve sequence end-to-end. | E2E tests previously skipped Solve test because it crashed headless Chrome. | Enabled full E2E verify for Test 3: Solve after scrambling. |
| 7. Quiet Console Output | Resolved console warning / 404 in browser. | Browser automatically requested `/favicon.ico` which returned 404. | Added `<link rel="icon" href="data:,">` to HTML head. |

### Verification (Playwright E2E results)
*   ✅ **Test 4: Solve on solved** -> PASS
*   ✅ **Test 1: Scramble visual** -> PASS
*   ✅ **Test 5: Reset** -> PASS
*   ✅ **Test 2: Manual play (Shift-free & Shift-based)** -> PASS (Manual drag register moves)
*   ✅ **Test 6: No console errors** -> PASS (0 warnings/404s)
*   ✅ **Test 3: Solve** -> PASS (Scrambled cube solved to solid faces successfully in E2E)

---

## Previous Run: 2026-06-23 (Run 1) — Fix solve algorithm + drag interaction (7 bugs total)

### Solve Algorithm (3 bugs — all PASS)
*   U/L face coordinate order corrected in `getSolverFacelets()`.
*   Direction sign corrected in `parseMove()` for negative-axis faces (L/D/B).
*   Gimbal-lock resolved in `checkSolved()` using quaternion dot-product.

### Drag Interaction (4 bugs — all PASS)
*   Cross-product axis detection replaced hardcoded per-face mapping.
*   Corrected `dragLayer` calculation along the rotation axis.
*   Vertical drag direction inversion fixed in NDC projections.
*   Notation face derivation fixed using axis + layer instead of clicked face.