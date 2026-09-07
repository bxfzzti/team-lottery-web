# Team Lottery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-login static team lottery that supports grouped rosters and four fair draw modes.

**Architecture:** Keep pure domain functions in `src/domain.js`, browser persistence in `src/storage.js`, and DOM orchestration in `src/app.js`. Serve a single responsive `index.html`; all employee data remains in local storage.

**Tech Stack:** Semantic HTML, CSS, browser ES modules, Web Crypto API, Node.js built-in test runner.

## Global Constraints

- No backend, authentication, analytics, or employee-data upload.
- Use `crypto.getRandomValues()`, never `Math.random()`, for production draws.
- Support current Chrome, Edge, Safari, and Firefox on desktop and mobile.
- Default to draws without replacement; a round reset restores eligibility.

---

### Task 1: Domain model and fair drawing

**Files:**
- Create: `package.json`
- Create: `src/domain.js`
- Test: `tests/domain.test.js`

**Interfaces:**
- Produces: `parseMembers(text)`, `buildCandidatePool(groups, mode, selectedGroupId)`, `drawItems(items, count, excludedIds, randomIndex)`, `secureRandomIndex(max)`.

- [ ] Write failing tests for separator parsing, de-duplication, pool selection, exclusion, count bounds, and deterministic injected drawing.
- [ ] Run `npm test`; expect failure because `src/domain.js` does not exist.
- [ ] Implement the four exported functions, representing each candidate as `{ id, name, groupId, groupName, type }`.
- [ ] Run `npm test`; expect all domain tests to pass.

### Task 2: Browser persistence

**Files:**
- Create: `src/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Produces: `createStorage(adapter, key)`, returning `{ load(), save(state), clear() }`.

- [ ] Write failing tests for valid load/save, corrupt JSON fallback, schema fallback, and clear.
- [ ] Run `npm test`; expect storage tests to fail.
- [ ] Implement defensive versioned JSON persistence with a safe empty-state fallback.
- [ ] Run `npm test`; expect all tests to pass.

### Task 3: Responsive application shell and roster editor

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `src/app.js`

**Interfaces:**
- Consumes: domain parsers and `createStorage`.
- Produces: group add, rename, delete, member editing, validation summary, and automatic local save.

- [ ] Build semantic page structure with roster, draw console, result stage, and history regions.
- [ ] Add the group-card renderer and delegated input/click handlers in `src/app.js`.
- [ ] Add live counts, duplicate warnings, empty-state messaging, and destructive-action confirmation.
- [ ] Style the page with an editorial “meeting room ballot” aesthetic and responsive breakpoints at 900px and 560px.
- [ ] Run `npm test`; expect all tests to remain green.

### Task 4: Draw state machine, animation, and history

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `buildCandidatePool`, `drawItems`, `secureRandomIndex`.
- Produces: four draw modes, no-repeat round state, reset, accessible results, and session history.

- [ ] Add mode-specific control visibility and start-button validation.
- [ ] Compute results before animation, update exclusion sets after reveal, and render group context.
- [ ] Add rolling-name animation with a reduced-motion bypass and guarded repeat clicks.
- [ ] Add history rendering and round reset without deleting the saved roster.
- [ ] Run `npm test`; expect all tests to pass.

### Task 5: Documentation and browser acceptance

**Files:**
- Create: `README.md`
- Create: `.gitignore`

**Interfaces:**
- Produces: local run instructions, privacy statement, feature list, and browser acceptance evidence.

- [ ] Document `python3 -m http.server 4173`, usage, storage behavior, and repository structure.
- [ ] Run `npm test`; expect all tests to pass.
- [ ] Start the local server and use a real browser at 1440px and 390px widths.
- [ ] Verify roster persistence, each draw mode, no-repeat behavior, reset, invalid-input errors, and reduced-motion behavior.
- [ ] Run `git diff --check`; expect no whitespace errors, then commit the finished project.

### Task 6: GitHub delivery

**Files:**
- Create: `.github/workflows/pages.yml` only if public Pages deployment is requested.

**Interfaces:**
- Produces: a GitHub repository URL containing the verified `main` branch.

- [ ] Confirm `gh auth status` succeeds and inspect whether the target repository already exists.
- [ ] Create a private `team-lottery-web` repository if no target was provided, add it as `origin`, and push `main`.
- [ ] Read back the remote repository URL and latest commit SHA; ensure it matches local `HEAD`.

