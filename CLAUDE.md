# CLAUDE.md

remark plugin that renders Amazon / Rakuten / Yahoo! affiliate product cards.
Five sites install it (impreza-gdb, blog, zc33s, je1wfv, triathlon); a broken
release breaks all five at once.

## Commands

```sh
bun test              # unit tests
bun run test:coverage # tests with the coverage gate
bun run typecheck     # tsc --noEmit
bun run lint          # biome check --write ./src (format + lint, applies fixes)
bun run lint:ci       # biome ci ./src (checks, changes nothing)
bun run build         # clean + tsc + copy card.css into dist/
```

## Tests

Every change lands with tests. The whole surface between a credential and a
rendered card is covered, and it stays that way:

- `bunfig.toml` sets a coverage threshold that **bun enforces per file**, not
  against the total — a new module with no tests fails the run even while the
  project average stays high. That is the point; do not lower it to go green.
- `bun run test:coverage` is what CI and the pre-push hook run. Run it before
  claiming anything passes.
- Tests that read credentials must pass an explicit `root` (a tmpdir) and
  save/delete/restore the environment variables they touch. The repository's
  own `.env` holds live credentials, and `resolveOptions` merges `process.env`
  last, so a test without that isolation reads real secrets.

## Formatting and linting

Biome, configured in `biome.json` for this repository's existing style: single
quotes, no semicolons, 100 columns. `noNonNullAssertion` is off because
`tsconfig` sets `noUncheckedIndexedAccess`, which makes `x[i]!` the ordinary way
to read an index the code just bounded.

## Git hooks

Husky, installed by the `prepare` script on `bun install`:

- **pre-commit** — `lint-staged` runs `biome check --write` over staged `.ts`
  files and restages what it fixed.
- **pre-push** — `bun run typecheck` and `bun run test:coverage`, which is what
  CI runs. Seconds here beats a round trip through CI.

If the hooks stop firing, `git config core.hooksPath` should read `.husky/_`;
`bun run prepare` puts it back.

## CI

`.github/workflows/ci.yml` runs on every push to main and every PR: Biome, then
typecheck + coverage + build. Action versions are pinned by SHA.

## Dependencies

- **Nothing here depends on Astro.** The only external runtime import in the
  package is `unist-util-visit`, in `dist/remark.js`; everything else is
  `node:fs` / `node:path`. The entry point default-exports the remark plugin.
  Astro sites are still the audience, but they consume it as a plugin through
  `createRemarkAmazon`, which is why there is no integration and no astro peer.
- `unified` and `@types/mdast` are runtime `dependencies`, not devDependencies:
  `dist/remark.d.ts` names both, so they have to reach a consumer's node_modules.
- `remark-directive` is an optional peer, not a dependency: it parses
  `::amazon`, Astro does not enable it, and a site using only `bareUrls` never
  parses a directive at all.
- No `"latest"` in `devDependencies` — it resolves differently on every fresh
  install.

## Releasing

**Invariant: the npm version, the git tag, and the GitHub release must always
match.** Every version published to npm has exactly one `vX.Y.Z` git tag and one
GitHub release pointing at the same commit. Never publish to npm without cutting
the matching release, and never cut a release for a version that was not
published.

Checklist for a release:

1. Bump `version` in `package.json` (semver: `fix:` → patch, `feat:` → minor,
   `feat!:` / `BREAKING CHANGE:` → major).
2. Commit as `chore: release X.Y.Z`.
3. Push the commit (ask the human first — pushing is never implicit).
4. `npm publish` — `prepublishOnly` runs the lint, the typecheck, the coverage
   gate and the build. Publish first, so a failing gate never leaves a GitHub
   release for a version npm does not have.
5. `gh release create vX.Y.Z --target <commit> --title vX.Y.Z --generate-notes`
   (this creates the tag server-side; no separate `git push --tags` needed).
6. Replace the generated notes with real ones: what changed, why, and whether
   the upgrade is safe. Every existing release has them.

Verify the three stay in step:

```sh
npm view remark-affiliate-card versions --json   # published versions
gh release list                                 # GitHub releases
git tag --sort=v:refname                        # tags
```

To find which commit a published version came from:
`npm view remark-affiliate-card@X.Y.Z gitHead`.

## Conventions

- Docs, code comments, and commit messages in English (public repository).
- Conventional commits: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`,
  `perf`, `ci`.
- Comments say why, not what. The repository is full of decisions that look
  arbitrary without their reason — read the neighbouring comment before
  changing one.
