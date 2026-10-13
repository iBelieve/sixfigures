// Fetches the latest monthly CPI-U value from the BLS public API (v1, no key)
// and writes it to data/cpi.json if it's newer than what's there.

import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../data/cpi.json', import.meta.url);
const cpi = JSON.parse(await readFile(path, 'utf8'));

const res = await fetch(`https://api.bls.gov/publicAPI/v1/timeseries/data/${cpi.series}`);
if (!res.ok) throw new Error(`BLS API returned HTTP ${res.status}`);
const body = await res.json();
if (body.status !== 'REQUEST_SUCCEEDED') {
  throw new Error(`BLS API: ${body.status} ${JSON.stringify(body.message)}`);
}

// Monthly observations only (skip M13 annual averages), and skip months BLS
// didn't publish, which come back as "-".
const months = body.Results.series[0].data
  .filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period) && Number.isFinite(Number(d.value)))
  .map((d) => ({ year: Number(d.year), month: Number(d.period.slice(1)), value: Number(d.value) }))
  .sort((a, b) => b.year - a.year || b.month - a.month);

const latest = months[0];
if (!latest || !(latest.value > 0)) throw new Error('No usable monthly CPI value in BLS response');

const current = cpi.latest;
const isNewer = latest.year > current.year || (latest.year === current.year && latest.month > current.month);

if (!isNewer) {
  console.log(`No new CPI data (latest is ${latest.year}-${latest.month}: ${latest.value})`);
} else {
  cpi.latest = latest;
  await writeFile(path, JSON.stringify(cpi, null, 2) + '\n');
  console.log(`Updated CPI to ${latest.year}-${latest.month}: ${latest.value}`);
}
