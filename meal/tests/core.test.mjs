import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_HALF_MEAL_COST_PAISA,
  CURRENT_MEAL_RATE_PAISA,
  LEGACY_MEAL_RATE_PAISA,
  MEAL_RATE_CHANGE_MONTH,
  buildMonthCsv,
  calculateMonth,
  currentDateKey,
  daysInMonth,
  formatMeals,
  formatMoney,
  halfMealCostPaisaForMonth,
  makeDateKey,
  mealRatePaisaForMonth,
  parseTakaToPaisa,
  shiftMonth,
  slotHalfUnits,
} from '../core.js';

test('rate schedule preserves Tk 52 history and applies Tk 55 from September 2026', () => {
  assert.equal(MEAL_RATE_CHANGE_MONTH, '2026-09');
  assert.equal(LEGACY_MEAL_RATE_PAISA, 5_200);
  assert.equal(CURRENT_MEAL_RATE_PAISA, 5_500);
  assert.equal(CURRENT_HALF_MEAL_COST_PAISA, 2_750);
  assert.equal(mealRatePaisaForMonth('2026-08'), 5_200);
  assert.equal(halfMealCostPaisaForMonth('2026-08'), 2_600);
  assert.equal(mealRatePaisaForMonth('2026-09'), 5_500);
  assert.equal(halfMealCostPaisaForMonth('2026-09'), 2_750);
  assert.equal(mealRatePaisaForMonth('2027-01'), 5_500);
});

test('every supported month follows the exact rate boundary without gaps', () => {
  for (let year = 2000; year <= 2100; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const expectedRate = monthKey >= '2026-09' ? 5_500 : 5_200;
      assert.equal(mealRatePaisaForMonth(monthKey), expectedRate, monthKey);
      assert.equal(halfMealCostPaisaForMonth(monthKey), expectedRate / 2, monthKey);
    }
  }
});

test('calendar length handles normal and leap years', () => {
  assert.equal(daysInMonth('2026-02'), 28);
  assert.equal(daysInMonth('2028-02'), 29);
  assert.equal(daysInMonth('2026-04'), 30);
  assert.equal(daysInMonth('2026-08'), 31);
});

test('breakfast is always one half-unit (0.5 meal)', () => {
  for (let day = 1; day <= 31; day += 1) {
    assert.equal(slotHalfUnits(makeDateKey('2026-08', day), 'breakfast'), 1);
  }
});

test('Friday lunch is 2 meals and other lunches are 1 meal', () => {
  assert.equal(slotHalfUnits('2026-08-07', 'lunch'), 4); // Friday
  assert.equal(slotHalfUnits('2026-08-06', 'lunch'), 2); // Thursday
});

test('Tuesday dinner is 2, Sunday dinner is 1.5, others are 1', () => {
  assert.equal(slotHalfUnits('2026-08-04', 'dinner'), 4); // Tuesday
  assert.equal(slotHalfUnits('2026-08-09', 'dinner'), 3); // Sunday
  assert.equal(slotHalfUnits('2026-08-05', 'dinner'), 2); // Wednesday
});

test('historical August week remains exactly 20 meals at Tk 52', () => {
  const entries = {};
  for (let day = 3; day <= 9; day += 1) {
    entries[makeDateKey('2026-08', day)] = { breakfast: true, lunch: true, dinner: true };
  }
  const summary = calculateMonth('2026-08', entries, 2_000_00);
  assert.equal(summary.mealRatePaisa, 5_200);
  assert.equal(summary.halfMealCostPaisa, 2_600);
  assert.equal(summary.actualHalfUnits, 40);
  assert.equal(formatMeals(summary.actualHalfUnits), '20');
  assert.equal(summary.spentPaisa, 104_000);
  assert.equal(summary.remainingPaisa, 96_000);
  assert.equal(summary.duePaisa, 0);
});

test('September 2026 week is exactly 20 meals at Tk 55', () => {
  const entries = {};
  for (let day = 7; day <= 13; day += 1) {
    entries[makeDateKey('2026-09', day)] = { breakfast: true, lunch: true, dinner: true };
  }
  const summary = calculateMonth('2026-09', entries, 2_000_00);
  assert.equal(summary.mealRatePaisa, 5_500);
  assert.equal(summary.halfMealCostPaisa, 2_750);
  assert.equal(summary.actualHalfUnits, 40);
  assert.equal(formatMeals(summary.actualHalfUnits), '20');
  assert.equal(summary.spentPaisa, 110_000);
  assert.equal(summary.remainingPaisa, 90_000);
  assert.equal(summary.duePaisa, 0);
});

test('August 2026 maximum follows weekday multipliers exactly', () => {
  const entries = {};
  for (let day = 1; day <= 31; day += 1) {
    entries[makeDateKey('2026-08', day)] = { breakfast: true, lunch: true, dinner: true };
  }
  const summary = calculateMonth('2026-08', entries, 0);
  assert.equal(summary.maximumHalfUnits, 176);
  assert.equal(summary.actualHalfUnits, 176);
  assert.equal(formatMeals(summary.actualHalfUnits), '88');
  assert.equal(summary.spentPaisa, 457_600);
  assert.equal(summary.duePaisa, 457_600);
  assert.equal(summary.specialExtraHalfUnits, 21);
});

test('September 2026 maximum uses Tk 55 and exact Tk 27.50 half-meals', () => {
  const entries = {};
  for (let day = 1; day <= 30; day += 1) {
    entries[makeDateKey('2026-09', day)] = { breakfast: true, lunch: true, dinner: true };
  }
  const summary = calculateMonth('2026-09', entries, 0);
  assert.equal(summary.maximumHalfUnits, 172);
  assert.equal(summary.actualHalfUnits, 172);
  assert.equal(formatMeals(summary.actualHalfUnits), '86');
  assert.equal(summary.spentPaisa, 473_000);
  assert.equal(summary.duePaisa, 473_000);
  assert.equal(summary.specialExtraHalfUnits, 22);
});

test('money input is parsed without floating-point arithmetic', () => {
  assert.equal(parseTakaToPaisa('3500'), 350_000);
  assert.equal(parseTakaToPaisa('৳3,500.25'), 350_025);
  assert.equal(parseTakaToPaisa('0.05'), 5);
  assert.equal(parseTakaToPaisa('1.999'), null);
  assert.equal(parseTakaToPaisa('-5'), null);
  assert.equal(formatMoney(2_750), '৳27.50');
  assert.equal(formatMoney(5_500, { forceDecimals: true }), '৳55.00');
  assert.equal(formatMoney(350_025), '৳3,500.25');
});

test('month shifting crosses year boundaries safely', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});

test('Dhaka date calculation uses the locked timezone', () => {
  const instant = new Date('2026-08-30T18:30:00.000Z');
  assert.equal(currentDateKey('Asia/Dhaka', instant), '2026-08-31');
});

test('historical CSV retains the August Tk 52 statement', () => {
  const summary = calculateMonth('2026-08', {
    '2026-08-07': { breakfast: true, lunch: true, dinner: false },
  }, 1_000_00);
  const csv = buildMonthCsv(summary);
  assert.match(csv, /2026-08-07,Friday,Yes,0.5,Yes,2,No,0,2.5,130.00/);
  assert.match(csv, /Meal rate \(BDT\),52.00/);
  assert.match(csv, /Total meals,2.5/);
  assert.match(csv, /Total cost \(BDT\),130.00/);
  assert.match(csv, /Remaining \(BDT\),870.00/);
});

test('September CSV exports the new Tk 55 rate and Tk 27.50 half-unit exactly', () => {
  const summary = calculateMonth('2026-09', {
    '2026-09-04': { breakfast: true, lunch: true, dinner: false },
  }, 1_000_00);
  const csv = buildMonthCsv(summary);
  assert.match(csv, /2026-09-04,Friday,Yes,0.5,Yes,2,No,0,2.5,137.50/);
  assert.match(csv, /Meal rate \(BDT\),55.00/);
  assert.match(csv, /Total meals,2.5/);
  assert.match(csv, /Total cost \(BDT\),137.50/);
  assert.match(csv, /Remaining \(BDT\),862.50/);
});
