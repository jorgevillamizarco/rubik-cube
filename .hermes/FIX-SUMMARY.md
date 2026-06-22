# Rubik's Cube — Fix Summary

> Applied: 2026-06-23 | Commit: see git log

## Bugs Fixed (2026-06-23: Solve Algorithm)

### 1. Solve Button Freezes Browser (CRITICAL)
**Symptom:** Clicking Solve does nothing — browser main thread blocks indefinitely.

**Root Cause:** `getSolverFacelets()` read the U and L faces front-to-back (z=+1→z=-1), but the cubejs Kociemba library expects back-to-front (z=-1→z=+1) per standard Singmaster facelet ordering. The mismatch produced a facelet string with correct color counts (9 of each) but a physically impossible cubie permutation. The Kociemba two-phase solver searched forever for a solution that didn't exist, blocking the main thread.

**Fix:** Reversed coordinate order for the U and L faces in `getSolverFacelets()`:
- U: `z=-1, 0, +1` (was `z=+1, 0, -1`)
- L: `z=-1, 0, +1` (was `z=+1, 0, -1`)
- R, F, D, B faces were already correct.

**Why R alone worked:** The R move only changes the right column of U (and L face is all-one-color). The reversed order happened to produce the same string for symmetric patterns. The bug only manifested after moves that affect U or L face stickers asymmetrically.

### 2. Wrong Rotation Direction for L, D, B (CRITICAL)
**Symptom:** Solver returns a valid solution, cube animates through all moves, but ends up not solved → "Solver error".

**Root Cause:** `parseMove()` used `sign = -1` for ALL faces. This is correct for positive-axis faces (R=+x, U=+y, F=+z) where clockwise-from-outside = -π/2. But for negative-axis faces (L=-x, D=-y, B=-z), clockwise-from-outside = +π/2. The `sign` must flip based on the face's layer direction.

**Fix:** Changed `const sign = -1` to `const sign = a.l > 0 ? -1 : 1`.

**Verification:** All 18 basic moves (R, R', R2, L, L', L2, ... B2) now produce facelet strings that exactly match cubejs.

### 3. checkSolved() Euler Gimbal-Lock (CRITICAL)
**Symptom:** After solver correctly solves cube (facelet string matches solved state), `checkSolved()` returns `false` → "Solver error".

**Root Cause:** `checkSolved()` used `THREE.Euler().setFromQuaternion()` to verify each cubie's orientation was at 90° increments. Three.js Euler decomposition enters gimbal-lock at pitch≈±π/2, using a different computation branch that produces wrong components. **62 of 64** valid cube orientations fail the Euler-based check.

**Fix:** Replaced Euler decomposition with quaternion dot-product:
```javascript
const q = c.quaternion;
let bestDot = 0;
for (let xi = 0; xi < 4; xi++)
  for (let yi = 0; yi < 4; yi++)
    for (let zi = 0; zi < 4; zi++) {
      const cand = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(xi*Math.PI/2, yi*Math.PI/2, zi*Math.PI/2));
      bestDot = Math.max(bestDot, Math.abs(q.dot(cand)));
    }
if (Math.abs(bestDot - 1) > 0.01) return false;
```
This is the same approach already used in `turnLayer`'s `snapQuat` function.

## Testing Results (2026-06-23)

| Test | Before | After |
|------|--------|-------|
| Solve after scramble (20 moves) | 🔴 Browser freezes | ✅ Solved! 🎉 |
| Solve after scramble (3 different scrambles) | 🔴 Browser freezes | ✅ All 3 solved |
| Facelet string matches cubejs (18 basic moves) | 🔴 6/18 mismatch | ✅ 18/18 match |
| Facelet string matches cubejs (compound sequences) | 🔴 Diverges after 2nd move | ✅ All match |
| checkSolved() on solved cube after compound rotations | 🔴 False (62/64 fail) | ✅ True |

---

## Previous Fixes (2026-06-12)

### 1. Sticker Rendering (CRITICAL)
**Symptom:** After scramble, tiles appeared in wrong positions visually.

**Root Cause:** Sticker material used `depthTest: false, depthWrite: false`.

**Fix:** Changed to `MeshStandardMaterial` with `polygonOffset` on body material (v3.2 approach).

### 2. Drag Interaction (CRITICAL)
**Symptom:** Shift+Drag on a face did nothing.

**Fix:** Replaced cross-product logic with camera-aware projection. Added `orbit.enabled = false` during Shift+drag.

### 3. Move Counter (MEDIUM)
**Fix:** `STATE.moves` derived from `STATE.history.length` in `updateMoveCounter()`.

### 4. Status Text Not Cleared (MEDIUM)
**Fix:** Added `statusEl.textContent = ''` to `hideStatus()`.

### 5. dragLastPos Hygiene (LOW)
**Fix:** Reset `dragLastPos = null` in both `onPointerDown` AND `onPointerUp`.