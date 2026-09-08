# Team Lottery Upgrade Implementation Plan

**Goal:** Make live draws resilient, add the highest-value meeting workflows, and publish a browser-tested build.

**Architecture:** Keep draw and import rules in pure domain functions. Persist roster, settings, inactive members, exclusions, and history as one versioned browser state; migrate the original roster-only state without losing names. Lock all mutable controls while the reveal animation is running.

**Tech Stack:** Semantic HTML, CSS, browser ES modules, Web Crypto API, Node.js test runner, Playwright CLI.

## Global Constraints

- Remain a static, login-free webpage with no employee-data upload.
- Full-roster draws give every active person equal probability; group-first draws give every eligible group equal probability.
- In group-first mode, only people are excluded after a draw; a group remains eligible while it contains an eligible person.
- Any roster change after drawing starts a clearly announced new round.

### Task 1: Durable draw state and rule corrections

- Add version-2 storage migration and save settings, exclusions, inactive members, and history.
- Disable roster and draw controls throughout the reveal animation.
- Validate draw counts without silently changing the user's value.
- Refresh visible group counts and duplicate warnings as names change.
- Test migration, state round trips, group-first repeat eligibility, and count validation.

### Task 2: Meeting workflows

- Add full employee order and full group order generation.
- Add temporary member participation toggles without deleting names.
- Add two-column spreadsheet paste import and UTF-8 CSV export.
- Add a presentation view that enlarges the result and can be exited without losing the round.

### Task 3: Browser acceptance and delivery

- Verify roster editing, local persistence, all draw modes, no-repeat behavior, reset, inactive members, import/export controls, presentation view, and mobile layout in a real browser.
- Update README, commit, push `main`, and compare remote SHA with local `HEAD`.
