// Fetches CPI-U from the BLS public API (v1, no key) and updates data/cpi.json
// with the latest monthly value and any newly published annual averages.

import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../data/cpi.json', import.meta.url);
const cpi = JSON.parse(await readFile(path, 'utf8'));

const res = await fetch(`https://api.bls.gov/publicAPI/v1/timeseries/data/${cpi.series}`);
if (!res.ok) throw new Error(`BLS API returned HTTP ${res.status}`);
const body = await res.json();
if (body.status !== 'REQUEST_SUCCEEDED') {
  throw new Error(`BLS API: ${body.status} ${JSON.stringify(body.message)}`);
}

// Skip values BLS didn't publish, which come back as "-".
const data = body.Results.series[0].data.filter((d) => Number(d.value) > 0);
const changes = [];

// Annual averages (M13) appear once a year is complete; add any we don't have.
for (const d of data.filter((d) => d.period === 'M13')) {
  if (!(d.year in cpi.annual)) {
    cpi.annual[d.year] = Number(d.value);
    changes.push(`annual ${d.year}: ${d.value}`);
  }
}
cpi.annual = Object.fromEntries(Object.entries(cpi.annual).sort(([a], [b]) => a - b));

const latest = data
  .filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period))
  .map((d) => ({ year: Number(d.year), month: Number(d.period.slice(1)), value: Number(d.value) }))
  .sort((a, b) => b.year - a.year || b.month - a.month)[0];
if (!latest) throw new Error('No usable monthly CPI value in BLS response');

const current = cpi.latest;
if (latest.year > current.year || (latest.year === current.year && latest.month > current.month)) {
  cpi.latest = latest;
  changes.push(`latest ${latest.year}-${latest.month}: ${latest.value}`);
}

if (changes.length === 0) {
  console.log(`No new CPI data (latest is ${latest.year}-${latest.month}: ${latest.value})`);
} else {
  await writeFile(path, JSON.stringify(cpi, null, 2) + '\n');
  console.log(`Updated CPI: ${changes.join('; ')}`);
}
