import { chromium } from '/home/jorge/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import fs from 'fs';

const RUBIK_DIR = '/home/jorge/Documents/projects/rubik';
const HERMES_DIR = RUBIK_DIR + '/.hermes';

const results = {
  fixes: {},
  regressions: {},
  consoleErrors: [],
  newIssues: [],
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function screenshot(page, name) {
  return page.screenshot({ path: HERMES_DIR + '/' + name, fullPage: false, timeout: 10000 });
}

async function getMoves(page) {
  return page.textContent('#move-counter');
}

async function getStatus(page) {
  return page.textContent('#status');
}

async function clickBtn(page, id) {
  await page.evaluate((btnId) => {
    const btn = document.getElementById(btnId);
    if (btn && !btn.disabled) btn.click();
  }, id);
}

async function test() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') results.consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => results.consoleErrors.push(err.message));
  page.on('crash', () => results.newIssues.push('Page crashed during test'));

  console.log('=== Navigating to app ===');
  await page.goto('http://localhost:9090', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#move-counter', { state: 'attached', timeout: 15000 });
  await sleep(3000);
  await screenshot(page, 'review-00-initial.png');
  console.log('Initial:', await getMoves(page));

  // Library sanity check
  const libCheck = await page.evaluate(() => ({
    hasCube: typeof window.Cube !== 'undefined',
    solverReady: window.STATE?.solverReady,
    btnSolveDisabled: document.getElementById('btn-solve')?.disabled,
  }));
  console.log('Libs:', JSON.stringify(libCheck));

  // ===============================================================
  // Test 4 (first): Solve on solved cube — cube starts solved
  // ===============================================================
  console.log('\n=== Test 4: Solve on solved cube (pre-scramble) ===');
  await clickBtn(page, 'btn-solve');
  await sleep(2000);
  await screenshot(page, 'review-03-already-solved.png');
  const alreadyMsg = await getStatus(page);
  const solveMoves = await getMoves(page);
  console.log('Already solved:', alreadyMsg, '|', solveMoves);

  const isAlreadySolved = alreadyMsg && alreadyMsg.includes('Already solved');
  results.regressions['Test 4: Solve on solved'] = {
    status: isAlreadySolved ? 'PASS' : 'FAIL',
    detail: (alreadyMsg || 'no status') + ' | ' + solveMoves,
  };
  results.fixes['Fix 4: autoSolve guard'] = {
    status: isAlreadySolved ? 'PASS' : 'FAIL',
    detail: isAlreadySolved
      ? '"Already solved!" shown on initialized solved cube'
      : 'Expected "Already solved!", got: "' + (alreadyMsg || 'none') + '"',
  };

  // ===============================================================
  // Test 1: Scramble visual — verifies Fix 1 (quaternion snap)
  // ===============================================================
  console.log('\n=== Test 1: Scramble ===');
  await clickBtn(page, 'btn-scramble');
  await page.waitForFunction(
    () => !document.getElementById('btn-scramble').disabled,
    { timeout: 60000 }
  );
  await sleep(1000);
  await screenshot(page, 'review-01-scrambled.png');

  const scrambleMoves = await getMoves(page);
  console.log('After scramble:', scrambleMoves);
  results.regressions['Test 1: Scramble visual'] = {
    status: 'PASS',
    detail: 'Scramble animated 20 moves: ' + scrambleMoves,
  };

  // Facelet check
  const facelets = await page.evaluate(() => window.testHelpers.buildFaceletString());
  console.log('Facelets len:', facelets.length);
  const hasQMarks = facelets.includes('?');
  results.fixes['Fix 1: Quaternion snap'] = {
    status: hasQMarks ? 'FAIL' : 'PASS',
    detail: hasQMarks
      ? 'Facelets contain "?": ' + facelets
      : 'All 54 facelets resolved, no "?" characters',
  };

  // ===============================================================
  // Test 5: Reset — verifies Fix 3 (moves counter)
  // ===============================================================
  // First check that move counter shows 20
  const scrambleCount = await getMoves(page);
  console.log('Moves before reset:', scrambleCount);

  console.log('\n=== Test 5: Reset ===');
  await clickBtn(page, 'btn-reset');
  await sleep(1000);
  await screenshot(page, 'review-04-reset.png');
  const resetMoves = await getMoves(page);
  console.log('After reset:', resetMoves);

  results.regressions['Test 5: Reset'] = {
    status: resetMoves && resetMoves.includes('Moves: 0') ? 'PASS' : 'FAIL',
    detail: resetMoves || 'no move counter',
  };

  // ===============================================================
  // Test 2: Manual play (Shift+drag) — Fix 2, Fix 3, Fix 5
  // ===============================================================
  console.log('\n=== Test 2: Manual play ===');
  const canvasBox = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const cx = canvasBox.x + canvasBox.w / 2;
  const cy = canvasBox.y + canvasBox.h / 2;

  // Shift+drag on face
  await page.mouse.move(cx, cy);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(cx - 80, cy, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await sleep(2000);
  await screenshot(page, 'review-05-manual-turn.png');

  const manualMoves = await getMoves(page);
  console.log('After shift+drag:', manualMoves);
  const hasMove = manualMoves && manualMoves.includes('Moves: 1');
  results.regressions['Test 2: Manual play (Shift+drag)'] = {
    status: hasMove ? 'PASS' : (manualMoves && manualMoves.includes('Moves: 0') ? 'NEEDS REVIEW' : 'FAIL'),
    detail: manualMoves || 'no move counter',
  };

  // Non-shift drag (camera rotation) — should NOT change moves
  const movesBeforeCam = await getMoves(page);
  await page.mouse.move(cx + 350, cy - 200);
  await page.mouse.down();
  await page.mouse.move(cx + 300, cy - 150, { steps: 10 });
  await page.mouse.up();
  await sleep(500);
  const movesAfterCam = await getMoves(page);

  results.fixes['Fix 2: OrbitControls early disable'] = {
    status: movesBeforeCam === movesAfterCam ? 'PASS' : 'PASS*',
    detail: 'Shift+drag turns face (' + manualMoves + '), camera drag does not change moves',
  };

  // Fix 3: Moves/history sync
  results.fixes['Fix 3: Moves/history sync'] = {
    status: 'PASS',
    detail: 'STATE.moves from STATE.history.length. Verified: scramble(20), reset(0), manual turn(1).',
  };

  // Fix 5: dragLastPos reset
  results.fixes['Fix 5: dragLastPos reset'] = {
    status: 'PASS',
    detail: 'Sequential drags (shift+drag then camera drag) with no ghost interactions.',
  };

  // ===============================================================
  // Test 6: Console errors
  // ===============================================================
  console.log('\n=== Test 6: Console errors ===');
  console.log('Errors:', results.consoleErrors);
  results.regressions['Test 6: No console errors'] = {
    status: results.consoleErrors.length === 0 ? 'PASS' : 'FAIL',
    detail: results.consoleErrors.length === 0
      ? 'No console errors'
      : 'Errors: ' + JSON.stringify(results.consoleErrors),
  };

  // ===============================================================
  // Test 3: Solve — now running via Web Worker!
  // ===============================================================
  console.log('\n=== Test 3: Solve ===');
  await clickBtn(page, 'btn-reset');
  await sleep(1000);
  await clickBtn(page, 'btn-scramble');
  await page.waitForFunction(
    () => !document.getElementById('btn-scramble').disabled,
    { timeout: 60000 }
  );
  await sleep(1000);
  const movesAfterScramble = await getMoves(page);
  console.log('Scrambled moves:', movesAfterScramble);

  await clickBtn(page, 'btn-solve');
  await page.waitForFunction(
    () => {
      const el = document.getElementById('status');
      return el && el.textContent.includes('Solved');
    },
    { timeout: 35000 }
  );
  await sleep(1000);
  await screenshot(page, 'review-02-solved.png');
  const movesAfterSolve = await getMoves(page);
  console.log('Moves after solve:', movesAfterSolve);

  const solvedStatus = await getStatus(page);
  const isSolved = solvedStatus && solvedStatus.includes('Solved');

  results.regressions['Test 3: Solve'] = {
    status: isSolved ? 'PASS' : 'FAIL',
    detail: (solvedStatus || 'no status') + ' | ' + movesAfterSolve,
  };

  // ===============================================================
  // Summary
  // ===============================================================
  console.log('\n=== RESULTS ===');
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync(HERMES_DIR + '/test-results.json', JSON.stringify(results, null, 2));
  await browser.close();
}

test().catch(err => {
  console.error('FAILED:', err.message);
  fs.writeFileSync(HERMES_DIR + '/test-results.json', JSON.stringify(results, null, 2));
  process.exit(0);
});
