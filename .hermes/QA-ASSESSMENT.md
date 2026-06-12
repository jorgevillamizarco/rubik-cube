# Rubik's Cube — QA Assessment

> Generated: 2026-06-11 (original) | Updated: 2026-06-12 (fresh investigation + fixes)
> Tools: Chrome DevTools MCP + Playwright MCP | Browser: Headless Chrome 149
> Server: `python3 -m http.server 9090` | URL: `http://localhost:9090/`

## Summary

| Area | Score (before fix) | Score (after fix) | Status |
|---|---|---|---|
| Core functionality (scramble/solve/reset) | 5/10 | 8/10 | ✅ Fixed |
| Drag interaction | 2/10 | 7/10 | ✅ Fixed |
| State management | 6/10 | 8/10 | ✅ Fixed |
| Performance | 10/10 | 10/10 | ✅ Unchanged |
| Accessibility | 8/10 | 8/10 | ⚠️ Still 81 Lighthouse |
| Code quality | 6/10 | 7/10 | ⚠️ Minor issues remain |

**Overall:** Scramble visual bug fixed (AlwaysDepth rendering), drag interaction fixed (projection-based axis detection + OrbitControls disable), move counter fixed (doMove increments STATE.moves).

---

## Fresh Investigation Delta (2026-06-12)

### What matched between old QA and fresh investigation

1. ✅ Scramble produces wrong visual state — CONFIRMED
2. ✅ Drag interaction does not work — CONFIRMED
3. ✅ State management issues — CONFIRMED
4. ✅ `dragLastPos` not reset — CONFIRMED (fixed)
5. ✅ Buttons visual state during animation — already partially fixed (disableButtons/enableButtons exist)

### What the old QA missed (found in fresh investigation)

1. **`depthTest: false` on stickers** — The old QA correctly identified that stickers render wrong, but attributed it to "sticker meshes must be updated." The actual root cause is `depthTest: false` on `MeshBasicMaterial`, which causes back-face stickers to render over front-face stickers. The sticker MESHES are rigid children of cubie groups and DO rotate correctly. The fix is `depthFunc: THREE.AlwaysDepth` with `MeshStandardMaterial` (per rubik-cube-fix skill v3.0.0).

2. **Coordinate system mismatch in drag handler** — The cross product `crossVectors(dragFaceNormal, dragDir)` mixed world-space face normal with screen-space drag direction (0 z-component). This is a fundamental math error that makes the rotation sign unreliable. The old QA attributed drag failure to "axis detection edge cases" and "camera-angle-dependent edge cases" without identifying the root cause.

3. **`hideStatus()` doesn't clear textContent** — After scramble completes, the status div still contains "Scrambling..." text (hidden by CSS opacity but present in DOM). This is a cosmetic but confusing bug.

4. **`doMove()` doesn't increment `STATE.moves`** — The old QA said `scramble()` and `autoSolve()` don't increment `STATE.moves`, but looking at the current code, `scramble()` DOES increment it. The actual bug is in `doMove()` (the reusable helper). The old QA's assessment to "remove STATE.moves entirely" was too aggressive — better to just ensure consistency.

5. **`MeshBasicMaterial` used instead of `MeshStandardMaterial`** — BasicMaterial ignores lighting, which makes stickers look flat and prone to depth artifacts. StandardMaterial with AlwaysDepth gives proper PBR rendering.

6. **OrbitControls not disabled during shift+drag** — When Shift is pressed for face turn drag, OrbitControls still handles the same pointer events, causing camera rotation simultaneously with the attempted face turn. The fix: `orbit.enabled = false` on shift+face-hit, re-enable on pointerup.

### What the old QA found that was already fixed before this session

1. AutoSolve retry loop — already removed in current code (now shows "Solve failed — please RESET")
2. Button disabled states — already implemented (`disableButtons()`/`enableButtons()`)
3. `e.preventDefault()` in pointer handlers — already present

### What remains unfixed (low priority)

1. Lighthouse Accessibility score 81 (missing button ARIA labels, canvas lacks accessible description)
2. Missing favicon (404 in console)
3. `FACE_NAMES` constant defined but never used
4. `dragPointerId` captured but unused
5. Code quality: `getFaceColor()` inlining, dead reject path in `turnLayer`

---

## Verified Functionality (PASS)

### Initial State
- 27 cubies in 27 unique grid positions (-1 to +1 on all axes) ✅
- Correct sticker colors on face cubies ✅
- Center cubie has no stickers (correct) ✅
- No console errors on load (only favicon.ico 404) ✅
- `checkSolved()` returns `true` ✅

### Scramble → Solve
- SCRAMBLE generates 20 random moves (non-repeating/adjacent) ✅
- History accumulates correctly (20 moves) ✅
- Animation completes without errors ✅
- SOLVE uses Kociemba two-phase algorithm ✅
- State snapshot/restore on solver failure ✅

### Edge Cases
- SOLVE when already solved: graceful no-op ✅
- SCRAMBLE/SOLVE/RESET guarded by `STATE.busy` ✅
- OrbitControls: rotate, zoom work ✅
- Buttons disabled during animation ✅

### Performance
- LCP: 25ms ✅
- CLS: 0.00 ✅
- TTFB: 1ms (local server) ✅
- Best Practices: 100/100 ✅

---

## Bugs Found (Pre-Fix)

### 🔴 CRITICAL #1: Sticker rendering — back-face stickers render over front-face

**Root cause:** `depthTest: false, depthWrite: false` on `MeshBasicMaterial` stickers. All stickers render regardless of depth. Scene traversal order determines which sticker draws on top — back-face stickers can render over front-face stickers.

**Fix:** Change to `depthFunc: THREE.AlwaysDepth` with `MeshStandardMaterial`. AlwaysDepth runs the depth test but always passes, so stickers always draw, but they write to the depth buffer. The first sticker drawn at a pixel wins. With `renderOrder: 1` on stickers and `renderOrder: 0` on body, stickers always render on top of the body.

### 🔴 CRITICAL #2: Drag handler uses mixed coordinate systems

**Root cause:** The cross product `crossVectors(dragFaceNormal, dragDir)` at old line 816 mixes world-space `dragFaceNormal` with screen-space `dragDir = (screenDx, screenDy, 0)`. This produces nonsensical results.

**Fix:** Project screen-space drag onto the face plane's tangential directions in screen space. Pick the axis with the larger-magnitude projection, and use its sign for rotation direction. Also disable OrbitControls (`orbit.enabled = false`) during shift+drag to prevent camera movement.

### 🟡 MEDIUM #1: `doMove()` doesn't increment `STATE.moves`

**Fix:** Added `STATE.moves++` to `doMove()`.

### 🟡 MEDIUM #2: `hideStatus()` doesn't clear textContent

**Fix:** Added `statusEl.textContent = '';` to `hideStatus()`.

---

## Code Quality Issues

| Issue | Location | Severity |
|---|---|---|
| `dragPointerId` captured but never used | ~line 710 | Low |
| `STEP` constant not exposed globally | Line 96 | Low |
| `FACE_NAMES` constant defined but never used | Line 115 | Trivial |
| No loading indicator while CDN Three.js loads | N/A | Low |
| `turnLayer` reject path is effectively dead code | Line 293 | Trivial |

---

## Testing Environment Notes

- **WebGL fallback:** Chrome in headless mode uses SwiftShader (software rendering). The "GPU stall due to ReadPixels" warning is expected and not a code bug.
- **THREE is not global:** `import * as THREE` (ES module) means `evaluate_script` cannot use `THREE`. Debug scripts must use `window.STATE` and DOM APIs only.
- **Server:** Uses `python3 -m http.server 9090` (no module bundler needed).

---

## Fixes Applied (2026-06-12 commit)

1. **Sticker material:** `MeshBasicMaterial` → `MeshStandardMaterial` with `depthFunc: THREE.AlwaysDepth`, `roughness: 0.3`, `metalness: 0.0`. Sticker depth 0.06→0.02.
2. **Drag handler:** Replaced screen×world cross product with camera-aware projection of screen drag onto face tangents. Added `orbit.enabled` toggling. Added `dragCommitted` guard to prevent double-fire.
3. **Move counter:** Added `STATE.moves++` to `doMove()`.
4. **Status text:** `hideStatus()` now clears `textContent`.
5. **Drag state:** `dragLastPos` reset on pointerdown, `dragAxis`/`dragLayer`/`dragAngle` properly initialized.
