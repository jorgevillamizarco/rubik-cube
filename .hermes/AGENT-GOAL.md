# Agent Goal: Fix Rubik's Cube Web Game

You are working on the Rubik's cube web game at /home/jorge/Documents/projects/rubik/. The app is a Three.js 3D Rubik's cube with SCRAMBLE, SOLVE, and RESET buttons plus drag-to-turn interaction.

## First — Read the Assessment

Read the QA assessment at /home/jorge/Documents/projects/rubik/.hermes/QA-ASSESSMENT.md — it documents all bugs found via Chrome DevTools MCP testing, with line numbers, evidence, and suggested fix approaches.

## What to Fix (Priority Order)

### CRITICAL #1: Sticker meshes not updated after rotation
The `updateStickersAfterRotation()` function updates `cubie.userData.stickers` (the data map) but the physical sticker meshes (Three.js PlaneGeometry children) are NOT recreated or re-materialized. After 20 scramble moves, all cubies visually show wrong sticker colors even though they're at correct grid positions. `checkSolved()` returns false because the data map is wrong.

**Fix:** After `updateStickersAfterRotation()` in `turnLayer`, either:
- Remove old sticker child meshes and create new ones based on the updated `userData.stickers` map, OR
- Iterate existing sticker children, determine their new face from their normal, and swap materials

### CRITICAL #2: Drag interaction does not work
Users cannot manually turn faces by dragging. The pointer event handlers (lines 498-635) exist but face turns are never triggered. Likely causes:
1. OrbitControls (camera rotation) conflicts with face-turn dragging — both listen for pointer events
2. Raycaster hits body meshes, not sticker meshes
3. Drag axis detection has camera-angle-dependent edge cases

**Fix:** 
- Implement a clear separation: regular drag = rotate view (OrbitControls), Shift+drag = turn face
- Or: detect if pointer-down hit a sticker (use raycaster against sticker meshes specifically)
- Add clear visual feedback (arrow indicator, face highlight) showing which turn will be triggered

### MEDIUM: STATE.moves counter disconnected from history
`scramble()` and `autoSolve()` never increment `STATE.moves`. Only the (broken) drag handler does. Either unify or derive from `STATE.history.length`.

### MEDIUM: autoSolve misleading retry
If `checkSolved()` fails after reversing all moves, it shows "Retrying solve..." but retry exits immediately (history is empty). Should show an error instead.

### MEDIUM: dragLastPos not reset on pointerdown
Old drag data leaks into new drags. Add `dragLastPos = null` in `onPointerDown`.

### LOW: Button disabled states, favicon, preventDefault, accessibility

## How to Work

1. **Read** /home/jorge/Documents/projects/rubik/.hermes/QA-ASSESSMENT.md first
2. **Read** /home/jorge/Documents/projects/rubik/index.html — understand the full code
3. **Start the server**: `python3 -m http.server 9090 --directory /home/jorge/Documents/projects/rubik` (port 8080 is taken by SearXNG)
4. **Use Chrome DevTools MCP** for visual debugging (3D/WebGL app — Playwright's accessibility tree won't help)
5. **Test after each fix**: reload → scramble → check sticker colors → solve → verify solved
6. **Take screenshots** at each step for visual verification
7. **Work in order**: fix critical bugs first, then medium, then low
8. **Write a brief summary** of what you fixed to /home/jorge/Documents/projects/rubik/.hermes/FIX-SUMMARY.md

## Key Technical Notes
- `THREE` is imported as an ES module — NOT available globally via `evaluate_script`. Use `window.STATE` for state checks.
- `STEP = 0.945` — grid spacing for cubie positions
- Cubies are stored in `window.STATE.cubies` (array of 27 Three.js Groups)
- Each cubie has `userData.grid`, `userData.orig`, `userData.stickers` (map of face→color)
- The pivot rotation pattern in `turnLayer` is correct — cubies are attached to pivot, rotated, then detached with grid-snapped positions
- OrbitControls handles camera rotation: `orbit.enableDamping = true`
- `checkSolved()` is exposed as `window.checkSolved()` for testing

## Skills to Load
Load these skills for context:
- `rubik-cube-fix` — documents previous fixes (pivot position, history accumulation, quaternion snap)
- `chrome-devtools-qa` — debugging patterns for 3D/WebGL apps
- `web-debugging` — tool selection framework
