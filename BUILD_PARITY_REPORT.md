# BUILD_PARITY_REPORT

Date: 2026-05-12

## Verified Parity Signals

1. `npm ci` succeeds from the repo after making devDependency inclusion explicit.
2. `npm run build` succeeds.
3. `npm run test:e2e -- --runInBand` succeeds with `67/67` tests passing.
4. `node dist/database/run-migrations.js` succeeds in production mode.

## Gaps Found and Fixed

### Native dependency drift

Original issue:
- `bcrypt` required native binaries and fell back to a local C++ toolchain on this Windows host

Fix:
- replaced with `bcryptjs`

### npm config drift

Original issue:
- effective npm config had `omit=["dev"]`, so `nest` and `jest` were silently absent after clean install

Fix:
- added `include=dev` to repo `.npmrc`
- made CI install steps explicit with `npm ci --include=dev --legacy-peer-deps`

### Build/runtime split

Original issue:
- Docker runtime boot path did not match migration-first production flow

Fix:
- Docker image and scripts now use migration-first startup

## Node Version Parity

Package metadata now declares:

1. `node >=20 <25`
2. `npm >=10 <11`

Observed local host during validation:

1. Node `24.14.1`
2. npm `11.11.0`

This host is outside the preferred range, but the repo-side install path now still validated successfully.