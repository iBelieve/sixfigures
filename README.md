# What's Six Figures Worth?

A one-page site showing what a $100,000 salary in 1985, 1990, 2000, and 2010 is worth in today's dollars, and what share of U.S. wage earners made $100k+ in each year.

Live at https://sixfigures.mspencer.io

## Data

- `data/cpi.json`: CPI-U (BLS series `CUUR0000SA0`). Annual averages for the key years are fixed; `latest` is the most recent monthly index and is updated daily by the [Update CPI data](.github/workflows/update-cpi.yml) workflow, which commits only when BLS publishes a new month.
- `data/ssa.json`: wage earners at or above $100,000 from Social Security Administration W-2 records ([Actuarial Note 135](https://www.ssa.gov/oact/NOTES/note135.html) for 1985 and 1990, [Wage Statistics](https://www.ssa.gov/cgi-bin/netcomp.cgi?year=2023) for later years). Update by hand when SSA publishes a new year (usually in the fall). `atOrAbove` is `total` minus the cumulative count through the $95,000–$99,999.99 bracket.

## Development

```bash
npm install
npm run dev          # local dev server
npm run update-cpi   # fetch the latest CPI month into data/cpi.json
npm run build        # static build to dist/
```

## Deployment

Cloudflare Workers Builds, connected to this repo's `master` branch:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

`wrangler.jsonc` serves `dist/` as static assets on the `sixfigures.mspencer.io` custom domain.
