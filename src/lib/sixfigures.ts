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
export const ssaSources = ssa.years;
export const cpiSource = cpi.source;

function shareFor(year: number) {
  const entry = ssa.years.find((y) => y.year === year);
  if (!entry) throw new Error(`No SSA data for ${year}`);
  return { share: entry.atOrAbove / entry.total, shareYear: entry.year };
}

const annual = cpi.annual as Record<string, number>;
const latestSsa = ssa.years[ssa.years.length - 1];

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
    ...shareFor(latestSsa.year),
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

export const formatPercent = (share: number) => `${(share * 100).toFixed(1)}%`;

/** N in "1 in N", from the exact share: two significant figures, whole numbers below 10. */
export function oneIn(share: number) {
  const n = 1 / share;
  return n < 10 ? Math.round(n) : Number(n.toPrecision(2));
}
