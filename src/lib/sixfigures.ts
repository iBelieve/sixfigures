import cpi from '../../data/cpi.json';
import ssa from '../../data/ssa.json';

const KEY_YEARS = [1985, 1990, 2000, 2010];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface Row {
  year: number;
  todayDollars: number;
  share: number;
  shareYear: number;
  isBaseline: boolean;
}

export const threshold = ssa.threshold;
export const currentYear = cpi.latest.year;
export const cpiMonthLabel = `${MONTHS[cpi.latest.month - 1]} ${cpi.latest.year}`;
export const cpiSource = cpi.source;
export const firstYear = ssa.years[0].year;

const annual = cpi.annual as Record<string, number>;
const latestSsa = ssa.years[ssa.years.length - 1];
export const latestSsaYear = latestSsa.year;

/** Share of earners at the threshold, falling back to the latest SSA year. */
function shareFor(year: number) {
  const entry = ssa.years.find((y) => y.year === year) ?? (year > latestSsa.year ? latestSsa : undefined);
  if (!entry) throw new Error(`No SSA data for ${year}`);
  return { share: entry.atOrAbove / entry.total, shareYear: entry.year };
}

export const rows: Row[] = [
  ...KEY_YEARS.map((year) => ({
    year,
    todayDollars: (threshold * cpi.latest.value) / annual[year],
    ...shareFor(year),
    isBaseline: false,
  })),
  {
    year: currentYear,
    todayDollars: threshold,
    ...shareFor(currentYear),
    isBaseline: true,
  },
];

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export const formatDollars = (n: number) => usd.format(Math.round(n / 1000) * 1000);

/** Short form for meta descriptions, e.g. "$311k". */
export const formatThousands = (n: number) => `$${Math.round(n / 1000)}k`;

export const formatPercent = (share: number) =>
  share < 0.0005 ? 'under 0.1%' : `${(share * 100).toFixed(1)}%`;

/** N in "1 in N", from the exact share: two significant figures, whole numbers below 10. */
export function oneIn(share: number) {
  const n = 1 / share;
  return (n < 10 ? Math.round(n) : Number(n.toPrecision(2))).toLocaleString('en-US');
}

export type Lookup =
  | { kind: 'under' }
  | { kind: 'over'; earliestEquivalent: number }
  | { kind: 'match'; year: number; share: number; shareYear: number };

/** CPI for each year from firstYear on, with the current year at its latest monthly value. */
const cpiByYear: [number, number][] = [
  ...Object.entries(annual)
    .map(([y, v]): [number, number] => [Number(y), v])
    .filter(([y]) => y >= firstYear && y < currentYear),
  [currentYear, cpi.latest.value],
];

/** Today's-dollar value of the threshold in the earliest year we cover. */
const earliestEquivalent = (threshold * cpi.latest.value) / cpiByYear[0][1];

/** The year in which `salary` (in today's dollars) was worth exactly the threshold. */
export function lookup(salary: number): Lookup {
  if (salary < threshold) return { kind: 'under' };
  // Allow for the table's rounding before saying it's beyond our earliest year.
  if (salary > earliestEquivalent * 1.01) return { kind: 'over', earliestEquivalent };
  const target = (threshold * cpi.latest.value) / salary;
  // Nearest year by price level. Prices dipped in 2009, so ties go to the later year.
  let best = cpiByYear[0];
  for (const entry of cpiByYear) {
    if (Math.abs(Math.log(entry[1] / target)) <= Math.abs(Math.log(best[1] / target))) best = entry;
  }
  return { kind: 'match', year: best[0], ...shareFor(best[0]) };
}

const usdExact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Parses "$150,000", "150k", or "1.2m". Returns NaN for anything else. */
export function parseSalary(input: string) {
  const m = input.trim().toLowerCase().replace(/[$,\s]/g, '').match(/^(\d+(?:\.\d+)?)([km]?)$/);
  if (!m) return NaN;
  return Number(m[1]) * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1);
}

/** The lookup result as an HTML sentence. Only numbers we format are interpolated. */
export function describe(salary: number) {
  const result = lookup(salary);
  const amount = `<strong>${usdExact.format(salary)}</strong>`;
  switch (result.kind) {
    case 'under':
      return `${amount} is under six figures, even today.`;
    case 'over':
      return `${amount} is more than six figures was worth even in ${firstYear} (${formatDollars(result.earliestEquivalent)} in today's dollars). Today, ${todaySentence(salary)}`;
    case 'match': {
      const share = `about 1 in ${oneIn(result.share)} earners (${formatPercent(result.share)})`;
      const dataNote = result.shareYear !== result.year ? ` (${result.shareYear} data)` : '';
      if (result.year === currentYear) {
        return `${amount} is six figures right now. ${capitalize(todaySentence(salary))}`;
      }
      return `${amount} today is what six figures was worth in <strong>${result.year}</strong>. That year, ${share} made $100,000 or more${dataNote}. Today, ${todaySentence(salary)}`;
    }
  }
}

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

const { brackets, total: distributionTotal, year: distributionYear } = ssa.distribution;

/**
 * Share of earners in the latest SSA year making at least `salary` (not inflation-adjusted),
 * interpolated log-linearly within SSA's wage brackets.
 */
export function shareAtOrAbove(salary: number) {
  const top = brackets[brackets.length - 1];
  if (salary >= top[0]) return { share: top[1] / distributionTotal, capped: salary > top[0] };
  const i = brackets.findIndex(([lo]) => lo > salary) - 1;
  if (i < 0) throw new Error(`No bracket for ${salary}`);
  const [lo, a] = brackets[i];
  const [hi, b] = brackets[i + 1];
  const t = Math.log(salary / lo) / Math.log(hi / lo);
  return { share: Math.exp(Math.log(a) + t * Math.log(b / a)) / distributionTotal, capped: false };
}

function todaySentence(salary: number) {
  const { share, capped } = shareAtOrAbove(salary);
  const amount = capped ? usdExact.format(brackets[brackets.length - 1][0]) : 'that much';
  return `about 1 in ${oneIn(share)} earners (${formatPercent(share)}) make ${amount} or more (${distributionYear} data).`;
}
