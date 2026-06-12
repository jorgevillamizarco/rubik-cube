# Research Findings: 5 Bugs in Rubik's Cube Web App

**Researcher:** Hermes Agent (researcher profile)  
**Date:** 2026-06-12  
**Project:** `/home/jorge/Documents/projects/rubik/index.html`  
**Verification:** Chrome 149 headless + Puppeteer (SwiftShader WebGL), `index.html` served via local HTTP server on port 8888

---

## Bug 1 — Scramble visually broken (CRITICAL)

**Status: CONFIRMED**

### Symptom
After scramble, sticker colors appear on wrong faces. The cube looks visually wrong despite the data model being correct.

### Root Cause
**Lines 347-351 — Euler-angle quaternion snap produces wrong quaternions for compound rotations.**

After each turn animation completes, the code captures the cubie's world quaternion, decomposes it to Euler angles (XYZ order), snaps each Euler component to the nearest `n × π/2`, and reconstructs a quaternion:

```javascript
const euler = new THREE.Euler().setFromQuaternion(worldQuat);
euler.x = Math.round(euler.x / (Math.PI / 2)) * (Math.PI / 2);
euler.y = Math.round(euler.y / (Math.PI / 2)) * (Math.PI / 2);
euler.z = Math.round(euler.z / (Math.PI / 2)) * (Math.PI / 2);
const snappedQ = new THREE.Quaternion().setFromEuler(euler);
```

This fails when compound rotations (e.g., R then U) produce a quaternion in a **gimbal-locked** Euler state (pitch ≈ ±π/2). In this state:

1. `setFromQuaternion` detects gimbal lock and assigns Euler components differently (using `atan2(-m12, m11)` for x instead of `atan2(m21, m22)`)
2. The snapped Euler angles reconstruct to a **different quaternion** than the original

### Evidence

**After 2 moves (R then U):** 3 cubies (the top-right-front corner column) have Euler-snap errors

| Cubie | Original Quat | Euler | Snap Diff |
|-------|--------------|-------|-----------|
| (-1,1,1) | (0.500, -0.500, -0.500, -0.500) | (-π/2, -π/2, 0) | 1.000 |
| (0,1,1)  | (0.500, -0.500, -0.500, -0.500) | (-π/2, -π/2, 0) | 1.000 |
| (1,1,1)  | (0.500, -0.500, -0.500, -0.500) | (-π/2, -π/2, 0) | 1.000 |

All three have the same pattern: Euler(-π/2, -π/2, 0) in gimbal lock. The `atan2(-m12, m11)` → `atan2(-1, 0)` = -π/2 is correct, but the opposite-roll convention differs from the non-gimbal-locked case, causing the reconstructed quaternion's z component to flip sign.

**After full 20-move scramble:** 11 of 27 cubies have Euler-snap errors

| Cubie | Snap Diff | Pattern |
|-------|-----------|---------|
| (-1,1,-1) | 1.414 | 90° rotation becomes 0° |
| (1,0,1)   | 1.414 | 90° rotation becomes 0° |
| (1,1,1)   | 1.000 | z flip in quat |
| (-1,-1,0) | 1.000 | z flip in quat |
| (0,-1,1)  | 1.000 | z flip in quat |

### Impact
Euler-snap errors cause cubies to have **incorrect quaternions** (wrong spatial orientation). Since sticker meshes are rigid children of the cubie group, they rotate with the cubie. A wrongly-oriented cubie means its stickers render at wrong world positions — the visual appearance of the cube is incorrect even though the data map (`userData.stickers`) tracks the right information.

### Recommended Fix
**Replace Euler-angle snap with direct quaternion rounding.** The rotation group of a Rubik's cube has only 24 valid orientations. All valid orientation quaternions have components that are one of: `±0.5`, `±1/√2 ≈ ±0.707`, `±1`, or `0`. Instead of Euler decomposition, round each quaternion component to the nearest valid value:

```javascript
function snapQuaternion(q) {
  const VALID = [0, 0.5, 0.707106781, 0.707106781, 1];
  // Actually: valid components are -1, -0.707, -0.5, 0, 0.5, 0.707, 1
  return new THREE.Quaternion(
    Math.round(q.x * 100) / 100,  // or snap to nearest valid value
    Math.round(q.y * 100) / 100,
    Math.round(q.z * 100) / 100,
    Math.round(q.w * 100) / 100,
  ).normalize();
}
```

Even simpler: since all cubie rotations after 90° face turns are exact compositions of π/2 rotations, the quaternion should naturally have components at ±½√2 intervals. Round each component to 2 decimal places and normalize.

**Affected lines:** 347-351 in `turnLayer()`

---

## Bug 2 — Drag interaction broken (CRITICAL)

**Status: PARTIALLY CONFIRMED — E2E drag works technically, but event ordering is fragile**

### Symptom
Shift+drag on a cube face may not reliably trigger a face turn. OrbitControls can compete with the face-turn handler.

### Root Cause
**Event listener registration order:** OrbitControls registers `pointerdown` on `renderer.domElement` (the canvas), while our handler registers on `document`. During the bubble phase:

1. **OrbitControls fires first** (on canvas, target phase)
2. **Our handler fires second** (on document, bubble phase)
3. By the time our handler sets `orbit.enabled = false` (line 772), OrbitControls has already started tracking and attached move/up listeners on `window` via `setPointerCapture`

### Evidence

**Browser test (E2E simulation):** Shift+drag **does produce a face turn** — `moves=1, history=[F]` after 50px drag. The handler successfully commits a move.

However, the reason it works is fragile:
- OrbitControls' `setPointerCapture` redirects all pointer events to the canvas, but **events still bubble up to document** (capture doesn't block bubbling)
- Our handler on `document` fires during bubble phase (before OrbitControls' `window`-level move handler)
- We set `orbit.enabled = false` in pointerdown → OrbitControls' move handler checks `enabled` and returns early

**The fragility:** If OrbitControls ever changes to:
- Use capture-phase listeners
- Call `stopPropagation()`
- Not check `this.enabled` in its move handler
- Use `setPointerCapture` in a way that blocks bubbling (non-standard behavior)

...then drag breaks.

Additionally, there's no `e.preventDefault()` override for OrbitControls. Our handler calls `e.preventDefault()` but OrbitControls already processed the event.

### Recommended Fix
Register our `pointerdown` handler on the **canvas directly** with `{ capture: true }` and call `stopPropagation` when Shift is held, preventing OrbitControls from seeing Shift+pointerdown events:

```javascript
renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true });
```

Or, simpler: check `e.shiftKey` early in the handler and call `e.stopPropagation()`:

```javascript
function onPointerDown(e) {
  if (e.shiftKey) {
    e.stopPropagation();  // Prevent OrbitControls from processing
  }
  // ... rest of handler
}
```

**Affected lines:** 717 (onPointerDown event registration at 936), 736-738 (shiftKey check)

---

## Bug 3 — STATE.moves disconnected from history (MEDIUM)

**Status: CONFIRMED**

### Symptom
Move counter shows wrong count during and after solve animation.

### Root Cause
**`autoSolve` (line 548) calls `turnLayer` directly (line 594), NOT `doMove`.** Only `doMove` increments `STATE.moves` and pushes to `STATE.history`. During solve animation, the actual moves being animated are invisible to the counter.

```javascript
// autoSolve (line 594):
await turnLayer(parsed.axis, parsed.layer, parsed.angle, SOLVE_SPEED);
// Should be:
// await doMove(m);
```

### Evidence
- After 3 manual moves (R, U, F): `moves=3, history=[R,U,F]` ✓ match
- `autoSolve.toString()` confirms: calls `turnLayer`, NOT `doMove`
- `autoSolve.toString()`: NO `STATE.moves++` anywhere in the function
- After autoSolve completes: `STATE.moves = 0` explicitly set (line 603)
- During solve animation: counter shows pre-solve value (stale for full duration)

### Impact
The move counter is wrong during the entire solve animation. If a user has done 10 manual moves and presses Solve, the counter stays at 10 during the 20-move solve animation, then jumps to 0.

### Recommended Fix
Option A (preferred): Have `turnLayer` return metadata about what was done and have the caller handle tracking.

Option B (minimal): After `autoSolve` completes, set `STATE.moves` to the solution length:

```javascript
STATE.moves = solutionMoves.length;
```

But this doesn't fix the visual during animation. Proper fix: increment `STATE.moves` in the solve loop:

```javascript
for (let i = 0; i < solutionMoves.length; i++) {
  await turnLayer(...);
  STATE.moves++;
  STATE.history.push(solutionMoves[i]);
  updateMoveCounter();
}
```

**Affected lines:** 548-618 (`autoSolve`), specifically line 594

---

## Bug 4 — autoSolve retry misleading (MEDIUM)

**Status: CONFIRMED**

### Symptom
After a failed solve + reset, pressing Solve gives no feedback — the button appears to do nothing.

### Root Cause
**Line 549: `if (!STATE.history.length) return;`** — After `resetCube()` → `buildCube()`, `STATE.history` is an empty array. The guard silently exits without any user-visible feedback.

```javascript
async function autoSolve() {
  if (STATE.busy || !STATE.history.length) return;
  ...
}
```

### Evidence
- Browser test: `autoSolve` on reset cube → `moves=0, history=0` unchanged
- No status message shown, no console output, no error
- `STATE.solverReady` remains `true` (correct — solver stays initialized)
- User sees the Scramble → Scramble flow, but pressing Solve does nothing with zero feedback

### Impact
After the sequence: Scramble → Solve (fails) → Reset → Solve → nothing happens. The user is confused and may think the app is broken.

### Recommended Fix
Replace the silent guard with an explicit status message:

```javascript
if (!STATE.history.length) {
  showStatus('Cube is already solved — try Scramble first', 'solved');
  return;
}
```

Also consider showing feedback when the cube IS solved but has history (autoSolve finds 0 solution moves but `checkSolved()` returns true — lines 575-583 handle this correctly with a "Solved! 🎉" message).

**Affected lines:** 548-549

---

## Bug 5 — dragLastPos not reset (MEDIUM)

**Status: CONFIRMED**

### Symptom
`dragLastPos` carries stale position data between drag gestures. In rare edge cases (pointerup without a preceding pointerdown), the stale value corrupts the next drag.

### Root Cause
**`dragLastPos` is set in `onPointerMove` (line 894) but NEVER reset in `onPointerUp` (lines 925-934).** It IS reset to `null` in `onPointerDown` (line 723), so a normal pointerdown→pointermove→pointerup cycle works correctly. But:

- If pointerup fires without a fresh pointerdown (edge case: browser loses focus mid-gesture, OS-level pointer events)
- `onPointerUp` runs → sets `dragActive = false` → `onPointerMove` early-returns
- Next pointerdown → `dragLastPos = null` → clean start

So in normal flow, Bug 5 is an **observational/dev concern**. The `onPointerDown` reset compensates.

### Evidence
- Source code analysis:
  - `onPointerDown` (line 723): `dragLastPos = null;` ✓
  - `onPointerMove` (line 894): `dragLastPos = { x: pos.x, y: pos.y };` ✓
  - `onPointerUp` (lines 925-934): NO `dragLastPos` reset ✗
- Browser test confirmed the function analysis
- In simulated drag cycles, `history` still increments correctly because `onPointerDown` always runs before subsequent move events

### Impact
Low. The `onPointerDown` reset at line 723 covers the normal case. Edge cases (browser tab switching mid-drag, rapid pointerup/down sequences) could carry stale `dragLastPos` into the cumulative drag calculation at line 878-879:

```javascript
const screenDx = pos.x - (dragLastPos?.x || dragStart.x);
const screenDy = pos.y - (dragLastPos?.y || dragStart.y);
```

The `|| dragStart.x` fallback makes it safe when `dragLastPos` is `null`, but a stale OBJECT value (not null) would be read as truthy.

### Recommended Fix
Add `dragLastPos = null;` to `onPointerUp`:

```javascript
function onPointerUp(e) {
  dragActive = false;
  dragLastPos = null;  // ADD THIS
  dragAxis = null;
  dragAngle = null;
  ...
}
```

**Affected lines:** 925-934 (`onPointerUp`)

---

## Summary

| Bug | Severity | Root Cause | Lines | Fix Complexity |
|-----|----------|------------|-------|----------------|
| 1. Scramble visual | CRITICAL | Euler-angle quaternion snap fails for compound rotations (gimbal lock) | 347-351 | Medium (replace with direct quat rounding) |
| 2. Drag interaction | CRITICAL | Event listener order: OrbitControls on canvas fires before our document handler | 717-772 | Low (register with capture=true on canvas) |
| 3. Moves counter | MEDIUM | autoSolve calls turnLayer not doMove; doesn't increment STATE.moves | 548-618 | Low (add STATE.moves++ in solve loop) |
| 4. Solve retry | MEDIUM | Silent guard `!STATE.history.length` returns without feedback | 549 | Low (add status message) |
| 5. dragLastPos | MEDIUM | Not reset in onPointerUp | 925-934 | Low (one-liner) |

## Screenshots
- `/tmp/rubik-test/after-RU.png` — Cube after 2-move scramble (R, U) — visual state
- `/tmp/rubik-test/after-scramble.png` — Cube after 20-move full scramble — visual state

## Test Script
- `/tmp/rubik-test/test-bugs-v3.js` — Puppeteer test script used for verification
