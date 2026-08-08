# 97 — Site housekeeping: build hash, issues link, CI warnings

**Kind:** chore · **Severity:** low · **Size:** small
**Closes:** [#14](https://github.com/atomic14/harmless/issues/14) ·
[#13](https://github.com/atomic14/harmless/issues/13) ·
[#12](https://github.com/atomic14/harmless/issues/12)

Three small, non-overlapping chores from the issue queue, batched as one
handoff because none touches gameplay code and together they are an
afternoon, not a feature.

## 1. Show the build hash on the site (#14)

Nobody can currently tell which build the live site is running. Inject the
commit hash at build time and show it.

- **Source of truth, in order:** `CF_PAGES_COMMIT_SHA` (Cloudflare Pages sets
  it during deploys) → `git rev-parse --short HEAD` → the literal `dev`. The
  fallback chain lives in ONE place in `vite.config.ts` and is exposed via a
  Vite `define` constant. Short hash (7 chars) is enough.
- **Where it shows:** a small footer line on the landing page (`index.html`),
  and the same line wherever the in-game issues link lands (below) — one
  shared treatment, not two. Link the hash to
  `https://github.com/atomic14/harmless/commit/<hash>` when it is a real
  hash; plain text when it is `dev`.
- Keep it quiet — phosphor-styled small print, not a banner.

## 2. Link to the issues page from everywhere (#13)

Chris: "available from anywhere on the site — including from within the
game." Add a link to `https://github.com/atomic14/harmless/issues/new`
reading something like `report a bug · request a feature`.

- **Static pages** (`index.html`, `manual.html`, `novella.html`,
  `gallery.html`, `viewer.html`, `encyclopaedia.html`): a shared footer
  line — build hash plus issues link. If these pages currently share no
  markup, a copied two-line footer is acceptable; do not build a templating
  system for a footer.
- **In game** (`play.html`): the `?` controls guide is reachable from
  anywhere in flight and when docked, so the issues link (and hash) goes at
  its foot — `src/ui/key-help.ts`. A browser `<a>` does not belong inside
  the canvas HUD; if the guide is canvas-drawn, print the short URL as text
  there and ALSO put the real link in the pause overlay or the page's HTML
  shell, whichever exists.

## 3. Silence the GitHub Actions deprecation warnings (#12)

`.github/workflows/ci.yml` pins `actions/checkout@v4` and
`actions/setup-node@v4`, which target Node 20 and now warn on every run.
Bump both to the current major (check what is current; do not guess),
keep `node-version: 22` and the npm cache setting, and change nothing else
in the workflow — its comments explain why steps run separately; keep them
true.

## Decisions already made

- One fallback chain for the hash, one home (`vite.config.ts`).
- Footer treatment is shared between hash and issues link — they are one
  line of small print.
- No new templating machinery for the static pages.

## Watch out for

- `npm run build` runs lint + tests via `prebuild`; the injected constant
  must be declared for TypeScript (a `declare const` in the right `.d.ts`,
  matching however the project declares Vite defines today — look before
  inventing).
- The dev server has no build step; the hash constant must still resolve
  under `npm run dev` (the `git rev-parse` fallback covers it — confirm).
- Do not touch gameplay, save, or combat code. This handoff is site chrome
  and CI only.

## Verification

No gameplay is touched, so the machine gates carry this alone:

- `npm run build` green (lint + tests via prebuild), `npm run elite-a`
  green, and the built `dist/` greps for the current short hash in the
  landing page and the play shell.
- `npm run preview` (or the dev server): the footer renders on the landing
  page and the issues link resolves; the `?` guide in game shows the line.
- Push the branch and let CI run: the deprecation warnings named in #12 are
  gone from the log.
- Claude eyeballs the landing page and the in-game guide in Chrome before
  landing: the footer reads as small print, not a banner.

## Outcome

**Shipped 2026-08-08**, the first cycle through docs/PROCESS.md. Built by a
background agent on its own branch; landed after a supervisor review of the
diff and a re-run of the gates on the merged tree (`npm run build` 3251
passed / 0 failed, `npm run elite-a` 494 / 0; dist greps show the linked
hash on every page and `issues/new` in all seven).

One deliberate deviation from this doc's prose: **no Vite `define`
constant.** The `?` guide's foot is static markup in `play.html`, so no
TypeScript ever reads the hash — a `transformIndexHtml` plugin fills a
`<!--BUILD-FOOTER-->` marker on every page instead, and the hash resolves
per page inside the hook so a long-lived dev server never serves a stale
one. The chain, the line and the plugin all live in `vite.config.ts`
(one home held); `test/site-footer.test.ts` pins the chain rung by rung,
reads the page roster from the config's own rollup inputs, and each of its
gates was deliberately broken once and went red.

CI actions went `v4 → v7` (current majors verified against the actions'
releases, not guessed). The warnings' disappearance is checked on the first
main CI run after this lands; if they persist, that comes back as a new
item rather than a silent edit here.
