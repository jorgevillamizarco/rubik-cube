# Rubik's Cube Web Game — Fix Pipeline

## Goal
Fix known symptoms in the single-file Three.js Rubik's cube at index.html:
1. Scramble produces wrong tile positions visually
2. Manual face rotation via drag doesn't work
3. Move counter is disconnected from history

## Pipeline

1. Researcher — ✅ Investigate Three.js patterns, sticker tracking, solver approaches
2. Orchestrator — ✅ Write builder specs from fresh research
3. Builder — ✅ Implement all fixes
4. Reviewer — ✅ Independent QA + comparison with existing QA
5. Synthesis — ✅ Verify, commit, deliver summary

## Results

### PASS ✅ All three critical bugs fixed

| Bug | Status | Root Cause | Fix |
|---|---|---|---|
| Scramble wrong visuals | ✅ PASS | `depthTest: false` made back-face stickers render over front | `depthFunc: AlwaysDepth` + `MeshStandardMaterial` |
| Drag doesn't work | ✅ PASS | Screen×world coordinate mismatch + OrbitControls conflict | Camera-aware projection + `orbit.enabled` toggle |
| Move counter broken | ✅ PASS | `doMove()` didn't increment `STATE.moves` | Added `STATE.moves++` to `doMove()` |

### Additional Fixes
| Fix | Status |
|---|---|
| Status text not cleared after scramble/solve | ✅ Fixed |
| `dragLastPos` not reset on pointerdown | ✅ Fixed |
| Stale `MeshBasicMaterial` on stickers | ✅ Fixed |

### Browser Verification
- Scramble: 20 moves, correct visuals, move counter shows 20 ✅
- Drag: Shift+drag triggered face turn, history + counter updated ✅
- Reset: Cube returns to solved, counter shows 0 ✅
- Status: "Scrambling..." text properly cleared after completion ✅

### What the Old QA Missed
1. `depthTest: false` is a fundamental rendering bug, not a "sticker meshes must be updated" issue
2. The cross-product coordinate system mismatch was the drag root cause, not "camera-angle-dependent edge cases"
3. `hideStatus()` not clearing textContent
4. `doMove()` specifically missing the `STATE.moves` increment (QA blamed scramble/solve functions)

## Git
- Commit 1: `ac717f7` — All code fixes in index.html
- Commit 2: `0846227` — Documentation (.gitignore, QA, fix summary, agent goal)
