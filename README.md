# Skiff Code themes

Popular community color themes, converted to the theme format of
[Skiff Code](https://github.com/bynaki/skiff), an Android code viewer and editor for files on SSH
servers. Each theme keeps the colors its authors chose: the editor, the syntax colors and the
interface are read from the theme's own VS Code theme or Vim/Neovim colorscheme, not picked again
from its palette.

These are unofficial conversions. None of the projects below made or endorse them.

## Using a theme

In Skiff Code, open the command palette and run **Download Theme...**. Pick a theme from the list; it
is downloaded, saved as one of your themes and turned on. **Theme...** switches between the themes
you have.

A file from `themes/` can also be brought in by hand with **Import Theme**. Either way the theme is
your copy: it does not change when this repository does, and downloading it again replaces it.

Every file starts with a comment naming its source, the commit it was read at and its license, and
each color has a comment saying what in the source it came from.

## Themes

45 themes from 15 projects. The id is the file name in `themes/` and the name the app saves the
theme under.

### Catppuccin

A soothing pastel theme in four flavors, from the light Latte to the dark Mocha.
[catppuccin/catppuccin](https://github.com/catppuccin/catppuccin), read from its VS Code theme,
[catppuccin/vscode](https://github.com/catppuccin/vscode). MIT.

| id | name |
|---|---|
| `catppuccin-latte` | Catppuccin Latte |
| `catppuccin-frappe` | Catppuccin Frappé |
| `catppuccin-macchiato` | Catppuccin Macchiato |
| `catppuccin-mocha` | Catppuccin Mocha |

### Dracula

A dark theme with vivid purple, pink and green, and Alucard, its light counterpart.
[dracula/dracula-theme](https://github.com/dracula/dracula-theme), read from its VS Code theme,
[dracula/visual-studio-code](https://github.com/dracula/visual-studio-code). MIT.

**Alucard is derived here, not an official port.** Dracula has no Alucard theme for VS Code, so it
was made from the Dracula VS Code theme by replacing each color with its Alucard counterpart in the
[Dracula specification](https://draculatheme.com/spec).

| id | name |
|---|---|
| `dracula` | Dracula |
| `alucard` | Alucard |

### Rosé Pine

Muted, natural colors in three variants: the dark main theme, Moon and the light Dawn.
[rose-pine/rose-pine-theme](https://github.com/rose-pine/rose-pine-theme), read from its VS Code
theme, [rose-pine/vscode](https://github.com/rose-pine/vscode). MIT.

| id | name |
|---|---|
| `rose-pine` | Rosé Pine |
| `rose-pine-moon` | Rosé Pine Moon |
| `rose-pine-dawn` | Rosé Pine Dawn |

### Tokyo Night

A clean theme after the lights of Tokyo at night, with three dark styles and a light one.
[folke/tokyonight.nvim](https://github.com/folke/tokyonight.nvim). Apache-2.0: these files are
modified from the original, as each one's header says.

| id | name |
|---|---|
| `tokyonight-night` | Tokyo Night Night |
| `tokyonight-storm` | Tokyo Night Storm |
| `tokyonight-moon` | Tokyo Night Moon |
| `tokyonight-day` | Tokyo Night Day |

### Winter is Coming

Cool blues for VS Code, in a dark blue, a dark and a light theme.
[johnpapa/vscode-winteriscoming](https://github.com/johnpapa/vscode-winteriscoming). MIT.

| id | name |
|---|---|
| `winter-is-coming-dark-blue` | Winter is Coming Dark Blue |
| `winter-is-coming-dark` | Winter is Coming Dark |
| `winter-is-coming-light` | Winter is Coming Light |

### Gruvbox

The retro groove colorscheme: warm, earthy colors, dark and light, each at three contrasts.
[morhetz/gruvbox](https://github.com/morhetz/gruvbox). MIT/X11, as its README and `package.json`
state; the repository has no license file.

| id | name |
|---|---|
| `gruvbox-dark-hard` | Gruvbox Dark Hard |
| `gruvbox-dark-medium` | Gruvbox Dark Medium |
| `gruvbox-dark-soft` | Gruvbox Dark Soft |
| `gruvbox-light-hard` | Gruvbox Light Hard |
| `gruvbox-light-medium` | Gruvbox Light Medium |
| `gruvbox-light-soft` | Gruvbox Light Soft |

### Kanagawa

Colors taken from Katsushika Hokusai's *The Great Wave off Kanagawa*: Wave, the darker Dragon and
the light Lotus. [rebelot/kanagawa.nvim](https://github.com/rebelot/kanagawa.nvim). MIT.

| id | name |
|---|---|
| `kanagawa-wave` | Kanagawa Wave |
| `kanagawa-dragon` | Kanagawa Dragon |
| `kanagawa-lotus` | Kanagawa Lotus |

### Everforest

A green based theme, warm and soft on the eyes, dark and light, each at three background contrasts.
[sainnhe/everforest](https://github.com/sainnhe/everforest). MIT.

| id | name |
|---|---|
| `everforest-dark-hard` | Everforest Dark Hard |
| `everforest-dark-medium` | Everforest Dark Medium |
| `everforest-dark-soft` | Everforest Dark Soft |
| `everforest-light-hard` | Everforest Light Hard |
| `everforest-light-medium` | Everforest Light Medium |
| `everforest-light-soft` | Everforest Light Soft |

### Vague

A cool, dark, low-contrast theme with muted colors.
[vague-theme/vague.nvim](https://github.com/vague-theme/vague.nvim). MIT.

| id | name |
|---|---|
| `vague` | Vague |

### Cyberdream

A high-contrast, futuristic and vibrant theme, with a light and a muted variant.
[scottmckendry/cyberdream.nvim](https://github.com/scottmckendry/cyberdream.nvim). MIT.

| id | name |
|---|---|
| `cyberdream` | Cyberdream |
| `cyberdream-light` | Cyberdream Light |
| `cyberdream-muted` | Cyberdream Muted |

### Kanagawa Paper

A remix of Kanagawa in softer, paper-like tones: the dark Ink and the light Canvas.
[thesimonho/kanagawa-paper.nvim](https://github.com/thesimonho/kanagawa-paper.nvim). MIT.

Canvas's text is kept at its source's colors, a contrast of 4.48:1 against its background, just
under the 4.5:1 the other themes meet.

| id | name |
|---|---|
| `kanagawa-paper-ink` | Kanagawa Paper Ink |
| `kanagawa-paper-canvas` | Kanagawa Paper Canvas |

### Oxocarbon

A dark and a light theme inspired by IBM Carbon.
[nyoom-engineering/oxocarbon.nvim](https://github.com/nyoom-engineering/oxocarbon.nvim). MIT.

| id | name |
|---|---|
| `oxocarbon-dark` | Oxocarbon Dark |
| `oxocarbon-light` | Oxocarbon Light |

### Flexoki

An inky color scheme for prose and code, dark and light.
[kepano/flexoki](https://github.com/kepano/flexoki). MIT.

| id | name |
|---|---|
| `flexoki-dark` | Flexoki Dark |
| `flexoki-light` | Flexoki Light |

### Vesper

A peppermint and orange flavored dark theme.
[raunofreiberg/vesper](https://github.com/raunofreiberg/vesper). MIT.

| id | name |
|---|---|
| `vesper` | Vesper |

### Ayu

A simple, bright and elegant theme in Light, Mirage and Dark.
[ayu-theme/ayu-colors](https://github.com/ayu-theme/ayu-colors), read from its VS Code theme,
[ayu-theme/vscode-ayu](https://github.com/ayu-theme/vscode-ayu). MIT.

| id | name |
|---|---|
| `ayu-light` | Ayu Light |
| `ayu-mirage` | Ayu Mirage |
| `ayu-dark` | Ayu Dark |

## How they are made

`scripts/data/` holds one file per project: the source repository and the commit it was read at,
its license in full, and for every theme each color with the name in the source it came from. Those
were read once from the source, VS Code themes by `scripts/vscode.ts` and Vim and Neovim
colorschemes by `scripts/neovim.ts`, which loads the colorscheme in a headless Neovim and reads its
highlight groups as Neovim draws them.

`npm run themes` writes `themes/`, `index.json` and `NOTICE.md` from those files, filling a color a
source has none for from another of its colors, and prints each theme's contrast. Nothing is
fetched. `npm test` checks that what is committed is what the script writes. Node 24 or later.

## License

The scripts are under the MIT license in `LICENSE`. Each theme is under its source project's
license; `NOTICE.md` has each project's license in full.
