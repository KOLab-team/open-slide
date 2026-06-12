# KOLab fork of open-slide

This is KOLab's maintained fork of [1weiho/open-slide](https://github.com/1weiho/open-slide).
We carry KOLab-specific changes (editor/inspector features, client-facing review
surface) that are **not** intended for upstream, and rebase onto upstream releases
periodically.

> **Golden rule:** keep our delta **small, isolated, and new-file-heavy.** Rebase
> pain is proportional to how many lines we change in files upstream also edits.
> Add new modules; touch existing upstream files with the fewest possible lines.

## Remotes

```
origin    git@github.com:KOLab-team/open-slide.git   # this fork
upstream  https://github.com/1weiho/open-slide.git    # original project
```

If `upstream` is missing after a fresh clone:
```bash
git remote add upstream https://github.com/1weiho/open-slide.git
git fetch upstream --tags
```

## Branch model

- `main` carries our KOLab changes on top of upstream, and is **rebased onto
  upstream release tags** periodically (force-pushed afterward).
- Every KOLab commit is prefixed `[kolab]` so it's obvious during a rebase which
  hunks are ours and why.

## Dev loop

It's a pnpm + Turbo monorepo (`packages/core`, `packages/cli`, `apps/*`).
Editing `packages/core` and seeing it live in a deck:

```bash
corepack pnpm@10.17.0 install        # once (approves esbuild/sharp builds)
corepack pnpm@10.17.0 dev:demo       # demo deck on local core → http://localhost:5173
# or: dev:web (docs site), dev (everything via turbo)
```

`dev:demo` builds `@open-slide/core` from this repo's source and serves
`apps/demo` against it — that's our "sample deck consuming the fork."

## Consuming the fork in real (production) decks

Pick one:
1. **Publish scoped packages** from this fork's CI (e.g. `@kolab/open-slide-core`)
   and depend on those in deck projects. (Cleanest for many decks.)
2. **pnpm `overrides` / git dependency** in a deck's `package.json` pointing at
   this fork. (Quick.)
3. **Add the deck under `apps/`** in this monorepo and run it here. (Best while
   actively building core features.)

## Rebasing onto a new upstream release

Do this **often and small** (per upstream release), not rarely and huge.

```bash
git fetch upstream --tags
# rebase onto a tested RELEASE TAG (safer than chasing upstream/main HEAD):
git tag --sort=-creatordate | head        # find the latest @open-slide/core@X.Y.Z
git rebase @open-slide/core@X.Y.Z          # resolve [kolab] conflicts as they come
corepack pnpm@10.17.0 install
corepack pnpm@10.17.0 build && corepack pnpm@10.17.0 test
corepack pnpm@10.17.0 dev:demo             # smoke-test our features still work
git push --force-with-lease origin main
```

A green rebase ≠ working features — upstream refactors can silently break code our
changes depend on. **Always rebuild + exercise our features after a rebase.**

## KOLab changes (keep this list current — it's the rebase survival guide)

For each change: what, where, why, and which existing upstream files it touches
(so a conflict is quick to understand).

| # | Change | New files | Upstream files touched | Notes |
|---|--------|-----------|------------------------|-------|
| 1 | Anchored comment stickers (PowerPoint-style) | `app/components/inspector/comment-overlay.tsx` | `app/routes/slide.tsx` (+1 import, +1 line next to `CommentWidget`) | Resolves a comment's source `line` → element via `data-slide-loc`; anchors an expandable pin using the same `getBoundingClientRect` technique as `inspect-overlay.tsx`'s `Frame`. Corner `CommentWidget` left intact. |

Planned (see the orchestrator session notes / project memory):
- **#1 Anchored comment stickers** — overlay expandable comment pins on the slide
  at each element's position (vs the current corner panel in
  `packages/core/src/app/components/inspector/comment-widget.tsx`).
- **#2 Apply-comments from the UI** — a hard-wired `apply-comments` dev-server
  endpoint that runs a *configurable* agent command; client/operator role split
  (clients comment = data; operator applies = agent).
- **#3 In-place text editing** — `contentEditable` on text elements writing back
  to the `.tsx` source via the existing fiber→source mapping.
- **#4 Drag/resize** — direct manipulation for **absolutely-positioned** elements
  only (writes `left/top/width/height` back to source). This one diverges most
  from upstream's flow-layout thesis → expect it to be fork-only forever.
