# E2E Tests (Playwright + TypeScript)

Basic UI test suite for the MERN Task Manager frontend.

## Setup

```bash
cd e2e
npm install
npx playwright install --with-deps chromium
```

## Running tests

Make sure the backend and frontend are running first (see root `README.md`), then:

```bash
npm test              # headless run
npm run test:headed   # run with a visible browser
npm run test:ui       # interactive Playwright UI mode
npm run report        # view the last HTML report
```

By default tests run against `http://localhost:5173`. Override with:

```bash
BASE_URL=http://localhost:3000 npm test
```

## Structure

- `playwright.config.ts` — Playwright configuration
- `pages/` — page object models
- `tests/` — test specs
