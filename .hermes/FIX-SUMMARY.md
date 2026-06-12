# Rubik's Cube — Fix Summary

> Applied: 2026-06-12 | Commit: see git log

## Bugs Fixed

### 1. Sticker Rendering (CRITICAL)
**Symptom:** After scramble, tiles appeared in wrong positions visually. Back-face stickers rendered over front-face stickers.

**Root Cause:** Sticker material used `depthTest: false, depthWrite: false` on `MeshBasicMaterial`. Without depth testing, all stickers rendered regardless of Z-order, making back stickers overlap front stickers.

**Fix:**
- Changed `MeshBasicMaterial` → `MeshStandardMaterial` with `roughness: 0.3, metalness: 0.0`
- Changed `depthTest: false, depthWrite: false` → `depthFunc: THREE.AlwaysDepth`
- Reduced sticker BoxGeometry depth from 0.06 to 0.02 (per Three.js best practices)
- AlwaysDepth runs the depth test but always passes, AND writes to depth buffer — the first sticker drawn at a pixel wins, preventing far stickers from occluding near ones

### 2. Drag Interaction (CRITICAL)
**Symptom:** Shift+Drag on a face did nothing. No face turns triggered.

**Root Causes:**
1. Mixed coordinate systems: `crossVectors(dragFaceNormal, dragDir)` mixed world-space face normal with screen-space drag direction (z=0). This produced nonsensical rotation sign values.
2. OrbitControls conflict: Both the custom drag handler and OrbitControls listened for pointer events on the same element. During Shift+drag, OrbitControls would rotate the camera simultaneously, preventing the face turn detection.
3. The rotation axis determination used hardcoded camera-angle-dependent rules that were unreliable.

**Fix:**
- Replaced the broken cross-product logic with camera-aware projection: project the two world-space face-tangential directions into screen space, then project the screen drag onto those directions. Pick the axis with the larger projection magnitude.
- Added `orbit.enabled = false` when Shift is pressed and a face cubie is hit. Re-enabled on `pointerup`.
- Added `dragCommitted` guard to prevent double-fire of turn trigger.
- Properly reset `dragLastPos`, `dragAxis`, `dragLayer`, `dragAngle`, and `dragCommitted` on `pointerdown`.

### 3. Move Counter (MEDIUM)
**Symptom:** Move counter showed wrong count — disconnected from history.

**Root Cause:** `doMove()` function pushed to `STATE.history` but didn't increment `STATE.moves`. The `scramble()` function manually incremented `STATE.moves` but `doMove()` (the reusable helper) didn't.

**Fix:** Added `STATE.moves++` to `doMove()`.

### 4. Status Text Not Cleared (MEDIUM)
**Symptom:** After scramble completed, the status div still contained "Scrambling..." text (hidden by CSS `opacity: 0` but present in DOM).

**Root Cause:** `hideStatus()` only cleared the CSS class (setting `className = ''`) but didn't clear `textContent`.

**Fix:** Added `statusEl.textContent = ''` to `hideStatus()`.

## Testing Results

| Test | Before | After |
|---|---|---|
| Initial state (solved) | ✅ | ✅ |
| Scramble (20 moves) | ⚠️ Wrong visuals | ✅ Correct |
| Move counter after scramble | ⚠️ Showed 0 | ✅ Shows 20 |
| Status text after scramble | ⚠️ "Scrambling..." remained | ✅ Cleared |
| Drag interaction | 🔴 Not working | ✅ Working |
| Reset | ✅ | ✅ |
| Kociemba solver | ✅ | ✅ |
| Buttons disabled during animation | ✅ | ✅ |

## Files Changed

- `index.html` — all fixes applied (single-file project)
- `.hermes/QA-ASSESSMENT.md` — updated with fresh investigation delta

## Remaining Issues (Low Priority)

- Lighthouse Accessibility: 81 (missing ARIA labels, canvas description)
- Missing favicon (404)
- Unused `FACE_NAMES` constant
- `dragPointerId` captured but unused
