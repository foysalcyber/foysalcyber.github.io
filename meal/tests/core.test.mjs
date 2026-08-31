import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEAL_RATE_PAISA,
  buildMonthCsv,
  calculateMonth,
  currentDateKey,
  daysInMonth,
  formatMeals,
  formatMoney,
  makeDateKey,
  parseTakaToPaisa,
  shiftMonth,
  slotHalfUnits,
} from '../core.js';

test('fixed meal rate is exactly Tk 55 in paisa', () => {
  assert.equal(MEAL_RATE_PAISA, 5_500);
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

test('one full Monday-to-Sunday week totals exactly 20 meals', () => {
  const entries = {};
  for (let day = 3; day <= 9; day += 1) {
    entries[makeDateKey('2026-08', day)] = { breakfast: true, lunch: true, dinner: true };
  }
  const summary = calculateMonth('2026-08', entries, 2_000_00);
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
  assert.equal(summary.spentPaisa, 484_000);
  assert.equal(summary.duePaisa, 484_000);
  assert.equal(summary.specialExtraHalfUnits, 21);
});

test('money input is parsed without floating-point arithmetic', () => {
  assert.equal(parseTakaToPaisa('3500'), 350_000);
  assert.equal(parseTakaToPaisa('৳3,500.25'), 350_025);
  assert.equal(parseTakaToPaisa('0.05'), 5);
  assert.equal(parseTakaToPaisa('1.999'), null);
  assert.equal(parseTakaToPaisa('-5'), null);
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

test('CSV output includes detailed entries and exact totals', () => {
  const summary = calculateMonth('2026-08', {
    '2026-08-07': { breakfast: true, lunch: true, dinner: false },
  }, 1_000_00);
  const csv = buildMonthCsv(summary);
  assert.match(csv, /2026-08-07,Friday,Yes,0.5,Yes,2,No,0,2.5,137.50/);
  assert.match(csv, /Total meals,2.5/);
  assert.match(csv, /Total cost \(BDT\),137.50/);
  assert.match(csv, /Remaining \(BDT\),862.50/);
});
