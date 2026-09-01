import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CURRENT_HALF_MEAL_COST_PAISA,
  CURRENT_MEAL_RATE_PAISA,
  LEGACY_MEAL_RATE_PAISA,
  MEAL_RATE_CHANGE_MONTH,
  halfMealCostPaisaForMonth,
  mealRatePaisaForMonth,
} from '../core.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('core rate constants are internally exact', () => {
  assert.equal(MEAL_RATE_CHANGE_MONTH, '2026-09');
  assert.equal(LEGACY_MEAL_RATE_PAISA, 5_200);
  assert.equal(CURRENT_MEAL_RATE_PAISA, 5_500);
  assert.equal(CURRENT_HALF_MEAL_COST_PAISA, 2_750);
  assert.equal(CURRENT_HALF_MEAL_COST_PAISA * 2, CURRENT_MEAL_RATE_PAISA);
  assert.equal(halfMealCostPaisaForMonth('2026-08') * 2, mealRatePaisaForMonth('2026-08'));
  assert.equal(halfMealCostPaisaForMonth('2026-09') * 2, mealRatePaisaForMonth('2026-09'));
});

test('application has no stale hard-coded Tk 52 calculation multiplier', () => {
  const app = read('app.js');
  assert.doesNotMatch(app, /\bMEAL_RATE_PAISA\b/);
  assert.doesNotMatch(app, /2_600|2600/);
  assert.match(app, /halfUnits \* halfMealCostPaisaForMonth/);
  assert.match(app, /summary\.maximumHalfUnits \* summary\.halfMealCostPaisa/);
  assert.match(app, /mealRatePaisa: mealRatePaisaForMonth\(state\.monthKey\)/);
  assert.match(app, /mealRatePaisa: summary\.mealRatePaisa/);
});

test('Firestore rules enforce the same August/September boundary', () => {
  const rules = read('firestore.rules');
  assert.match(rules, /return usesCurrentMealRate\(monthId\) \? 5500 : 5200;/);
  assert.match(rules, /data\.mealRatePaisa == expectedMealRatePaisa\(monthId\)/);
  assert.match(rules, /hasOnly\(\['advancePaisa', 'mealRatePaisa', 'updatedAt'\]\)/);
});

test('frontend fallback copy and modules are rate-versioned', () => {
  const html = read('index.html');
  const worker = read('service-worker.js');
  const installer = read('pwa-install.js');
  assert.match(html, /id="sidebarMealRate">৳55</);
  assert.match(html, /id="formulaHalfRate">Total half-units × ৳27\.50</);
  assert.match(html, /৳52 through August 2026, then ৳55/);
  assert.match(html, /app\.js\?v=1\.3\.0/);
  assert.match(html, /pwa-install\.js\?v=1\.3\.0/);
  assert.match(worker, /meal-ledger-shell-v5/);
  assert.match(worker, /core\.js\?v=1\.3\.0/);
  assert.match(installer, /service-worker\.js\?v=1\.3\.0/);
});

test('package and runtime release versions agree', () => {
  const packageJson = JSON.parse(read('package.json'));
  const app = read('app.js');
  assert.equal(packageJson.version, '1.3.0');
  assert.match(app, /const APP_VERSION = '1\.3\.0';/);
});
