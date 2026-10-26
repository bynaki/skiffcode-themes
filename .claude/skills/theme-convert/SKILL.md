---
name: theme-convert
description: Convert a community color theme that is not in this list into one Skiff Code theme file, user-themes/<name>.toml, for one person to bring in with Import Theme. Run only as /theme-convert <repository URL> [variant].
argument-hint: <repository URL> [variant]
disable-model-invocation: true
---

# /theme-convert: one theme, outside the list

Converts one theme the way every theme in this list was converted, and writes it to
`user-themes/<name>.toml` for one person to import (Skiff Code's `Import Theme`). It does **not**
add the theme to the list: that is a data file in `scripts/data/` committed here, which is not this
skill's work. It does not commit, and it does not carry the file to a device.

Arguments: `$ARGUMENTS` — the theme's repository URL, then optionally which variant (a flavor, a
light or dark side, a contrast level). Without a URL, ask for one and stop.

**The method is the design's, not this file's.** Read the section "바꾸는 방법" of
`docs/skiffcode.spec/community-themes.md` in a checkout of Skiff Code (`bynaki/skiff`; look beside
this repository for one that has the file) before reading the source. Take the checkout whose mapping
table has a row for every key in `reference/light.toml`: `main` lags behind a key change until the
work is merged into it, and a branch beside it may be ahead. It holds the mapping table,
how each reader chooses, and the cases met so far (a theme only in a release's `.vsix`, a Vim
colorscheme's options, a license with no file). Do not copy the table here or work from memory of it.

Work in the session's scratchpad. The only file this writes in the repository is the theme.

## 1. Pick the source

In the order the design gives: ① a VS Code theme JSON in the same repository or the same org,
② a Neovim/Vim colorscheme, ③ that project's helix or zed port. Clone into the scratchpad and note
the commit read (`git rev-parse HEAD`, all 40 characters) and the file's path in the repository.
A repository that builds its JSON and does not commit it is read from the matching release's
`.vsix`, as Catppuccin and Dracula were; say so in `source`.

There are readers for ① and ② only. For ③, tell the user there is no reader, and read it by hand
from the table only if they agree.

When the variant is unclear (the repository has several themes and none was named), list them and
ask.

## 2. The license

Read the repository's license file: its SPDX id, the copyright line, and the full text as it is.
A source with no license file, or with one that is not permissive (MIT, Apache-2.0, BSD, ISC and the
like), is not refused — the file is for one person's own use — but it goes in the report (step 6).
With no license text at all, `licenseText` is `""` and `license` says what was found (`none`, or
what the README claims, as Gruvbox's case in the design does).

## 3. The data

Read the colors with the repository's reader:

```bash
node scripts/vscode.ts <theme.json>                                         # → { title, base, colors }
node scripts/neovim.ts <plugin dir> <colorscheme> [light|dark] [<ex command>...]  # → { base, colors }; needs nvim
```

Write a data file in the scratchpad with the shape of any file in `scripts/data/`
(`scripts/data/vesper.json` is a short one), holding **exactly one theme**: `family`,
`repository`, `commit`, `license`, `copyright`, `licenseText`, and `themes: [{ id, title, base,
source, colors }]`. `id` is the title in lowercase letters, digits and `-`. `colors` is the reader's
output as it is; a key it left out is filled by the generator, never by a color picked here. A
source read by hand gives each color's `from` as the name in the source.

## 4. The name

The file's name is the theme's name in Skiff Code. Start from the theme's title and hold it to what
`Import Theme` takes (`Themes.nameOf`): up to 64 characters, letters, digits, spaces, `_`, `-`, `(`
and `)`, starting with a letter or digit, no space at either end.

- **`system`, `light` and `dark`**, in any case, are Skiff Code's own and are refused. If that is
  the name (or the one the user asked for), propose another (`Light (Ayu)`, the family's name with
  the variant) and ask.
- If `user-themes/<name>.toml` is already there, ask whether to replace it (then remove it) or name
  it otherwise. The script will not overwrite it.
- A name that is also an id in `index.json` is written, but say so: downloading that theme from the
  list later would ask to replace this one.

## 5. Write it

```bash
npm run themes -- --one <scratchpad data file> --out "user-themes/<name>.toml"
```

It prints the contrast table and writes nothing on any problem, saying what. Fix the data from the
source and run it again — never edit the written file by hand.

- **`editor.foreground` below 4.5:1** against `editor.background` stops it. Tell the user the ratio
  and the two colors. If they choose the source's colors anyway, add `lowContrast` to the theme with
  the reason (`the source has #616569 on #e1e1de, 4.48:1; kept as it is`) and run it again.
- A `base` that contradicts the background is a reader's mistake or a source that calls itself
  light while drawing dark; check the source, and ask if it is the latter.

Then check that the theme is the only thing that changed: `git status --short` is what it was
before (the file is under `user-themes/`, which is ignored), and the file starts with its title,
`Source:` with the repository and the commit, and `License:`.

## 6. Report

In the user's language: the file's path; the source (repository, commit, file); the license, and a
warning when it is missing or not permissive; the contrast table, pointing out syntax colors below
3:1 and the sidebar's `git_modified`/`git_untracked` below 4.5:1 against `ui.background` (both
reported only, as the design says); what the script noted; and that nothing was committed. To
see it in Skiff Code the file goes to the device and in through `Import Theme`; that is not done
here. Say which app it needs: `Import Theme` takes one file with no format check, so an app older
than the keys in `reference/light.toml` reads the file as having a key it does not know and draws
the whole theme in its bundled colors. The format the file was made for is `FORMAT` in
`scripts/generate.ts`.
