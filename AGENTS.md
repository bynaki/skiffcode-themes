# AGENTS.md

Guidance for coding agents working in this repository.

This is the list of community themes Skiff Code downloads (`Download Theme...`). The app reads
`index.json` and `themes/<id>.toml` from `main` over raw.githubusercontent.com, with no login, so
what is pushed to `main` is what every user sees.

## Commands

```bash
npm ci
npm run themes    # writes themes/, index.json and NOTICE.md from scripts/data/
npm run themes -- --one <data file> --out <name>.toml   # one theme outside the list, nothing else
npm test          # tsc, then vitest
node scripts/vscode.ts <theme.json>                                         # a VS Code theme → colors
node scripts/neovim.ts <plugin dir> <colorscheme> [light|dark] [<ex command>...]  # needs nvim
```

Node 24 or later: it runs the `.ts` files directly.

## Rules

- **Never edit `themes/`, `index.json` or `NOTICE.md` by hand.** Change the data file in
  `scripts/data/` and run `npm run themes`; the tests fail on any difference.
- **A data file is written once from its source**, by `vscode.ts` or `neovim.ts`, and records the
  repository, the commit read, the file and the license in full. Generating never fetches anything.
  Re-reading a source means a new commit SHA in its data file.
- **The keys are Skiff Code's.** `reference/light.toml` is a copy of the app's
  `code/src/main/assets/themes/light.toml`, and `generate.ts`'s `FALLBACK` must list the same keys
  in the same order. When the app changes its theme keys, copy the file again, update `FALLBACK`
  and both readers' `SOURCES`, and raise `FORMAT` in `generate.ts`: the app refuses a list whose
  `format` is higher than it knows, and an older app would refuse the new keys.
- **Whether the app's parser takes every file is checked from the app's repository**:
  `SKIFF_THEMES_DIR=<this checkout> ./gradlew :code:testDebugUnitTest` there. Run it before pushing.
- `editor.foreground` must be 4.5:1 against `editor.background`. A theme whose source is below that
  says why in its data's `lowContrast`, and the test fails once that is no longer true.
- Ids are lowercase letters, digits and `-`, and never `system`, `light` or `dark` (the app's own).
- The design, the mapping table and the decisions behind them are in Skiff Code's
  `docs/skiffcode.spec/community-themes.md` (Korean).

## One theme for one person: `/theme-convert`

`/theme-convert <repository URL> [variant]` (`.claude/skills/theme-convert/`, run as a command only)
converts a theme that is not in the list by the same method and writes it to
`user-themes/<name>.toml`, for one person to bring into Skiff Code with `Import Theme`. It does not
add anything to the list: its data stays in the session's scratchpad, and **`user-themes/` is in
`.gitignore` and is never committed** — this repository is public, and what is there is someone's
own. The app's `SKIFF_THEMES_DIR` test reads `user-themes/` too, when it is there.
