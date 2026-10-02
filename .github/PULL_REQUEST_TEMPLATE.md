## Summary

<!-- One or two sentences: what does this PR do and why does it exist? -->

## Changes

<!-- Bullet the meaningful changes. Group by area if the PR touches more than one. -->

-

## Why

<!-- Context a reviewer needs: the decision behind the approach, alternatives rejected, links to the design doc or issue. -->

## Screenshots

<!-- Required for any visual change: before/after or a capture of the new UI. Delete this section for non-visual PRs. -->

## Testing

<!-- What you ran and what you observed. "CI is green" alone is not enough for behavioral changes. -->

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds
- [ ] Manually verified in the browser (visual/interactive changes)

## Checklist

- [ ] Branch follows naming convention (`feat/`, `fix/`, `chore/`, `docs/`)
- [ ] No file does more than one job; new components are one-per-file
- [ ] Content changes go through `src/content` with zod schemas
- [ ] No secrets, tokens, or `.env` values committed
