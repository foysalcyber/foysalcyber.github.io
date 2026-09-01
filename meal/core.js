export const APP_NAME = 'Meal Ledger';
export const APP_TIME_ZONE = 'Asia/Dhaka';
export const MEAL_RATE_CHANGE_MONTH = '2026-09';
export const LEGACY_MEAL_RATE_PAISA = 5_200;
export const CURRENT_MEAL_RATE_PAISA = 5_500;
export const CURRENT_HALF_MEAL_COST_PAISA = CURRENT_MEAL_RATE_PAISA / 2;
export const SLOT_ORDER = Object.freeze(['breakfast', 'lunch', 'dinner']);
export const WEEKDAY_NAMES = Object.freeze([
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]);

const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function parseMonthKey(monthKey) {
  const match = MONTH_KEY_RE.exec(String(monthKey));
  if (!match) throw new TypeError(`Invalid month key: ${monthKey}`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2100) {
    throw new RangeError('Supported years are 2000 through 2100.');
  }
  return { year, month };
}

export function mealRatePaisaForMonth(monthKey) {
  // Month keys are zero-padded YYYY-MM values, so lexical ordering is
  // chronological after validation. Settled months through August 2026 retain
  // the former Tk 52 rate; September 2026 onward uses Tk 55.
  const normalizedMonthKey = String(monthKey);
  parseMonthKey(normalizedMonthKey);
  return normalizedMonthKey >= MEAL_RATE_CHANGE_MONTH
    ? CURRENT_MEAL_RATE_PAISA
    : LEGACY_MEAL_RATE_PAISA;
}

export function halfMealCostPaisaForMonth(monthKey) {
  const ratePaisa = mealRatePaisaForMonth(monthKey);
  if (ratePaisa % 2 !== 0) throw new RangeError('Meal rate must divide exactly into half-meals.');
  return ratePaisa / 2;
}

export function daysInMonth(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function makeDateKey(monthKey, day) {
  const count = daysInMonth(monthKey);
  const dayNumber = Number(day);
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > count) {
    throw new RangeError(`Invalid day ${day} for ${monthKey}.`);
  }
  return `${monthKey}-${String(dayNumber).padStart(2, '0')}`;
}

export function parseDateKey(dateKey) {
  const match = DATE_KEY_RE.exec(String(dateKey));
  if (!match) throw new TypeError(`Invalid date key: ${dateKey}`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthKey = `${match[1]}-${match[2]}`;
  if (year < 2000 || year > 2100 || day > daysInMonth(monthKey)) {
    throw new RangeError(`Invalid calendar date: ${dateKey}`);
  }
  return { year, month, day, monthKey };
}

export function weekdayIndex(dateKey) {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function slotHalfUnits(dateKey, slot) {
  if (!SLOT_ORDER.includes(slot)) throw new TypeError(`Invalid meal slot: ${slot}`);
  const weekday = weekdayIndex(dateKey);

  // One half-unit equals 0.5 meal. Keeping totals in integer half-units
  // prevents floating-point drift and makes every calculation exact.
  if (slot === 'breakfast') return 1; // 0.5 meal every day
  if (slot === 'lunch') return weekday === 5 ? 4 : 2; // Friday = 2 meals
  if (weekday === 2) return 4; // Tuesday dinner = 2 meals
  if (weekday === 0) return 3; // Sunday dinner = 1.5 meals
  return 2;
}

export function dayRule(dateKey) {
  const weekday = weekdayIndex(dateKey);
  return {
    breakfast: 1,
    lunch: weekday === 5 ? 4 : 2,
    dinner: weekday === 2 ? 4 : weekday === 0 ? 3 : 2,
  };
}

export function sanitizeDayEntry(entry) {
  return {
    breakfast: entry?.breakfast === true,
    lunch: entry?.lunch === true,
    dinner: entry?.dinner === true,
  };
}

export function calculateMonth(monthKey, entries = {}, advancePaisa = 0) {
  const count = daysInMonth(monthKey);
  const mealRatePaisa = mealRatePaisaForMonth(monthKey);
  const halfMealCostPaisa = halfMealCostPaisaForMonth(monthKey);
  const safeAdvance = Number.isSafeInteger(advancePaisa) && advancePaisa >= 0
    ? advancePaisa
    : 0;

  const slotTotals = {
    breakfast: { halfUnits: 0, checkedDays: 0 },
    lunch: { halfUnits: 0, checkedDays: 0 },
    dinner: { halfUnits: 0, checkedDays: 0 },
  };

  let actualHalfUnits = 0;
  let maximumHalfUnits = 0;
  let activeDays = 0;
  let specialExtraHalfUnits = 0;
  const daily = [];

  for (let day = 1; day <= count; day += 1) {
    const dateKey = makeDateKey(monthKey, day);
    const entry = sanitizeDayEntry(entries[dateKey]);
    const values = dayRule(dateKey);
    const maxForDay = values.breakfast + values.lunch + values.dinner;
    let actualForDay = 0;

    for (const slot of SLOT_ORDER) {
      maximumHalfUnits += values[slot];
      if (!entry[slot]) continue;
      actualForDay += values[slot];
      slotTotals[slot].halfUnits += values[slot];
      slotTotals[slot].checkedDays += 1;

      if (slot === 'lunch' && values.lunch === 4) specialExtraHalfUnits += 2;
      if (slot === 'dinner' && values.dinner > 2) {
        specialExtraHalfUnits += values.dinner - 2;
      }
    }

    actualHalfUnits += actualForDay;
    if (actualForDay > 0) activeDays += 1;

    daily.push({
      day,
      dateKey,
      weekday: weekdayIndex(dateKey),
      entry,
      values,
      actualHalfUnits: actualForDay,
      maximumHalfUnits: maxForDay,
      costPaisa: actualForDay * halfMealCostPaisa,
    });
  }

  const spentPaisa = actualHalfUnits * halfMealCostPaisa;
  const balancePaisa = safeAdvance - spentPaisa;

  return {
    monthKey,
    days: count,
    mealRatePaisa,
    halfMealCostPaisa,
    daily,
    actualHalfUnits,
    maximumHalfUnits,
    spentPaisa,
    advancePaisa: safeAdvance,
    balancePaisa,
    remainingPaisa: Math.max(0, balancePaisa),
    duePaisa: Math.max(0, -balancePaisa),
    activeDays,
    slotTotals,
    specialExtraHalfUnits,
    specialExtraCostPaisa: specialExtraHalfUnits * halfMealCostPaisa,
    completionPercent: maximumHalfUnits
      ? (actualHalfUnits / maximumHalfUnits) * 100
      : 0,
  };
}

export function halfUnitsToMeals(halfUnits) {
  if (!Number.isInteger(halfUnits)) throw new TypeError('Half-units must be an integer.');
  return halfUnits / 2;
}

export function formatMeals(halfUnits) {
  const meals = halfUnitsToMeals(halfUnits);
  return Number.isInteger(meals) ? String(meals) : meals.toFixed(1);
}

export function formatMoney(paisa, { symbol = true, forceDecimals = false } = {}) {
  if (!Number.isSafeInteger(paisa)) throw new TypeError('Money must be integer paisa.');
  const hasFraction = Math.abs(paisa % 100) !== 0;
  const formatted = new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: forceDecimals || hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(paisa / 100);
  return symbol ? `৳${formatted}` : formatted;
}

export function parseTakaToPaisa(value) {
  const normalized = String(value).trim().replace(/[৳,\s]/g, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;

  const whole = Number(match[1]);
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const paisa = whole * 100 + Number(fraction || 0);
  return Number.isSafeInteger(paisa) && paisa <= 100_000_000 ? paisa : null;
}

export function currentDateKey(timeZone = APP_TIME_ZONE, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function currentHour(timeZone = APP_TIME_ZONE, now = new Date()) {
  const value = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now).find((part) => part.type === 'hour')?.value;
  return Number(value ?? 12);
}

export function shiftMonth(monthKey, delta) {
  const { year, month } = parseMonthKey(monthKey);
  const shifted = new Date(Date.UTC(year, month - 1 + Number(delta), 1));
  const shiftedYear = shifted.getUTCFullYear();
  if (shiftedYear < 2000 || shiftedYear > 2100) return monthKey;
  return `${shiftedYear}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthKey, style = 'long') {
  const { year, month } = parseMonthKey(monthKey);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: style,
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function buildMonthCsv(summary) {
  const rows = [[
    'Date',
    'Day',
    'Breakfast eaten',
    'Breakfast meals',
    'Lunch eaten',
    'Lunch meals',
    'Dinner eaten',
    'Dinner meals',
    'Total meals',
    'Cost (BDT)',
  ]];

  for (const item of summary.daily) {
    rows.push([
      item.dateKey,
      WEEKDAY_NAMES[item.weekday],
      item.entry.breakfast ? 'Yes' : 'No',
      item.entry.breakfast ? formatMeals(item.values.breakfast) : '0',
      item.entry.lunch ? 'Yes' : 'No',
      item.entry.lunch ? formatMeals(item.values.lunch) : '0',
      item.entry.dinner ? 'Yes' : 'No',
      item.entry.dinner ? formatMeals(item.values.dinner) : '0',
      formatMeals(item.actualHalfUnits),
      formatMoney(item.costPaisa, { symbol: false, forceDecimals: true }),
    ]);
  }

  rows.push([]);
  rows.push(['SUMMARY']);
  rows.push(['Total meals', formatMeals(summary.actualHalfUnits)]);
  rows.push(['Meal rate (BDT)', formatMoney(summary.mealRatePaisa, { symbol: false, forceDecimals: true })]);
  rows.push(['Total cost (BDT)', formatMoney(summary.spentPaisa, { symbol: false, forceDecimals: true })]);
  rows.push(['Advance (BDT)', formatMoney(summary.advancePaisa, { symbol: false, forceDecimals: true })]);
  rows.push([
    summary.balancePaisa >= 0 ? 'Remaining (BDT)' : 'Due (BDT)',
    formatMoney(Math.abs(summary.balancePaisa), { symbol: false, forceDecimals: true }),
  ]);

  return rows
    .map((row) => row.map((cell) => {
      const text = String(cell ?? '');
      return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    }).join(','))
    .join('\r\n');
}
