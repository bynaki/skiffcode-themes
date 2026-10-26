// Writes the themes from their bundles' data files:
//
//   npm run themes
//
// reads every `data/*.json` and writes `themes/<id>.toml` for each theme in it, and `index.json` and
// `NOTICE.md` at the root, then prints each theme's contrast against its background. The files it
// writes are committed, and `themes.test.ts` holds them to being what this writes. Nothing is fetched:
// a data file holds the colors already read from its source, by `vscode.ts`, `neovim.ts` or by hand,
// each with the name it came from.
//
//   npm run themes -- --one <data file> --out <name>.toml
//
// writes one theme that is not in the list, for one person to import (`/theme-convert`): the data
// file's single theme, by the same code, with its license in full at the end of the file instead of
// in `NOTICE.md`. Nothing else is touched.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

/** One color, and the name in the source it was read from. */
export interface Picked {
  value: string
  from: string
}

export interface ThemeData {
  /** Lowercase and `-`: `settings.toml`'s `theme` and the file's name. */
  id: string
  /** What the palette shows. */
  title: string
  base: 'light' | 'dark'
  /** The file in the source the colors were read from, at the bundle's commit. */
  source: string
  /** By Skiff key; a key left out is filled by [FALLBACK]. */
  colors: Record<string, Picked>
  /** Why this theme's `editor.foreground` is let be below [MIN_CONTRAST]: the source's own colors. */
  lowContrast?: string
}

/** One collection of themes from one source, as a data file holds it. */
export interface Bundle {
  family: string
  repository: string
  commit: string
  /** An SPDX id. */
  license: string
  copyright: string
  licenseText: string
  themes: ThemeData[]
}

/**
 * Every Skiff key in the order the files list them, with the key that fills it when the source has
 * nothing for it. Null is a key the source must give. Skiff Code's `ThemeToml.KEYS` is the list
 * itself; `themes.test.ts` holds this to `reference/light.toml`, a copy of the app's own light theme.
 */
export const FALLBACK: Record<string, string | null> = {
  'ui.background': 'editor.background',
  'ui.foreground': 'editor.foreground',
  'ui.muted': 'syntax.comment',
  'ui.border': 'editor.gutter_border',
  'ui.faint': 'ui.muted',
  'ui.subtle': 'editor.selection',
  'ui.accent': 'syntax.definition',
  'ui.scrim': 'editor.background',
  'ui.strong_background': 'ui.foreground',
  'ui.strong_foreground': 'ui.background',
  'ui.git_modified': 'diff.changed',
  'ui.git_untracked': 'diff.added',
  'editor.background': null,
  'editor.foreground': null,
  'editor.gutter_background': 'editor.background',
  'editor.gutter_foreground': 'ui.muted',
  'editor.gutter_border': 'ui.border',
  'editor.cursor': 'editor.foreground',
  'editor.selection': 'ui.subtle',
  'editor.code_background': 'ui.background',
  'syntax.keyword': null,
  'syntax.atom': 'syntax.literal',
  'syntax.literal': null,
  'syntax.string': null,
  'syntax.regexp': 'syntax.string',
  'syntax.definition': null,
  'syntax.local': 'editor.foreground',
  'syntax.type': null,
  'syntax.class': 'syntax.type',
  'syntax.macro': 'syntax.keyword',
  'syntax.property': 'editor.foreground',
  'syntax.comment': null,
  'syntax.meta': 'syntax.comment',
  'syntax.invalid': null,
  'syntax.warning': null,
  'diff.added': null,
  'diff.removed': null,
  'diff.changed': null,
}

/** The alpha a scrim filled from the background gets. */
const SCRIM_ALPHA = '99'

/** What `ThemeToml` takes as a color. */
const COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/

/** What each table is for, the same words `light.toml` and `dark.toml` use. */
const SECTIONS: Record<string, string> = {
  ui: 'The menu, the sidebar, the palette, the open files menu and the banner.',
  editor: 'The document: the code views and rendered markdown.',
  syntax: 'The colors of code, in the code views and in rendered markdown.',
  diff: "The diff layer's lines, tinted by diff_alpha, and the git gutter's bars.",
}

/** [color] as `#rrggbbaa`. */
function expand(color: string): string {
  const hex = color.slice(1)
  const full = hex.length <= 4 ? [...hex].map((it) => it + it).join('') : hex
  return `#${full.length === 6 ? `${full}ff` : full}`
}

function channels(color: string): number[] {
  const full = expand(color)
  return [1, 3, 5, 7].map((at) => parseInt(full.slice(at, at + 2), 16))
}

/** [color] drawn over the opaque [under], as the opaque color that results. */
export function over(color: string, under: string): string {
  const [r, g, b, a] = channels(color)
  const [ur, ug, ub] = channels(under)
  const mix = (top: number, bottom: number) => Math.round((top * a + bottom * (255 - a)) / 255)
  return `#${[mix(r, ur), mix(g, ug), mix(b, ub)].map((it) => it.toString(16).padStart(2, '0')).join('')}`
}

/** WCAG's contrast ratio of two opaque colors. */
export function contrast(a: string, b: string): number {
  const luminance = (color: string) => {
    const [r, g, bl] = channels(color).map((it) => {
      const c = it / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Every key of [theme], each with the name it came from: its own color, or the one [FALLBACK] names.
 * A color with alpha is kept as it is, except under `diff`, where `diff_alpha` multiplies it again
 * — those are drawn over the background first. Throws, naming the theme and the key, for a color
 * that is not one, a key no file has, or a key the source must give and does not.
 */
export function resolve(theme: ThemeData): Record<string, Picked> {
  for (const [key, picked] of Object.entries(theme.colors)) {
    if (!(key in FALLBACK)) throw new Error(`${theme.id}: ${key} is not a theme key`)
    if (!COLOR.test(picked.value)) throw new Error(`${theme.id}: ${key} = "${picked.value}" is not a color`)
  }
  const done: Record<string, Picked> = {}
  const pick = (key: string, asking: string[]): Picked => {
    if (done[key]) return done[key]
    const own = theme.colors[key]
    if (own) return (done[key] = own)
    const from = FALLBACK[key]
    if (from === null) throw new Error(`${theme.id}: the source gives no ${key}, and nothing stands in for it`)
    if (asking.includes(from)) throw new Error(`${theme.id}: the source gives neither ${[...asking, key].join(' nor ')}`)
    const value = pick(from, [...asking, key]).value
    if (key === 'ui.scrim') {
      return (done[key] = { value: `${expand(value).slice(0, 7)}${SCRIM_ALPHA}`, from: `none in the source: ${from} at alpha ${SCRIM_ALPHA}` })
    }
    return (done[key] = { value, from: `none in the source: ${from}` })
  }
  const colors: Record<string, Picked> = {}
  for (const key of Object.keys(FALLBACK)) colors[key] = pick(key, [])
  const background = colors['editor.background'].value
  for (const key of ['diff.added', 'diff.removed', 'diff.changed']) {
    const { value, from } = colors[key]
    if (expand(value).endsWith('ff')) continue
    colors[key] = { value: over(value, background), from: `${from}, over editor.background` }
  }
  // Text on the sidebar, which is measured against it: drawn over it once here, as the diff colors are.
  const sidebar = opaqueOver(colors['ui.background'].value, background)
  for (const key of GIT_KEYS) {
    const { value, from } = colors[key]
    if (expand(value).endsWith('ff')) continue
    colors[key] = { value: over(value, sidebar), from: `${from}, over ui.background` }
  }
  return colors
}

/** The keys drawn as text on `ui.background`: the sidebar tree's changed files (Skiff Code's M15). */
const GIT_KEYS = ['ui.git_modified', 'ui.git_untracked']

/** [color] as it shows over [under], opaque either way. */
function opaqueOver(color: string, under: string): string {
  return expand(color).endsWith('ff') ? color : over(color, under)
}

/** Where the themes are published, which a file names since it travels without the rest. */
export const REPOSITORY = 'https://github.com/bynaki/skiffcode-themes'

/**
 * The comment a theme file starts with: what it is, where from, under what license, and [where]
 * the license's text is, in two lines.
 */
function header(bundle: Bundle, theme: ThemeData, where: [string, string]): string[] {
  return [
    `# ${theme.title}, converted to a Skiff Code theme.`,
    `# Source: ${bundle.repository} at ${bundle.commit},`,
    `#   ${theme.source}`,
    `# License: ${bundle.license}, ${bundle.copyright}. ${where[0]}`,
    `#   ${where[1]}`,
    '# The comment after each color names what in the source it came from.',
  ]
}

/** [theme]'s file, from the data file [dataName] of [bundle]. */
export function toml(bundle: Bundle, theme: ThemeData, dataName: string): string {
  const where: [string, string] = [
    'The full text is in NOTICE.md of',
    `${REPOSITORY}, written by scripts/generate.ts there from scripts/data/${dataName}.`,
  ]
  return `${[...header(bundle, theme, where), ...body(theme)].join('\n')}\n`
}

/**
 * The file of [bundle]'s one theme as one person keeps it, outside the list: the same as [toml]
 * writes but for where the license is, which is in full at the end, since no NOTICE.md has it.
 */
export function single(bundle: Bundle): string {
  const [theme] = bundle.themes
  const where: [string, string] = [
    'The full text is at the end of this file,',
    `which scripts/generate.ts of ${REPOSITORY} wrote outside its list.`,
  ]
  const text = bundle.licenseText.trimEnd()
  const license = text
    ? ['# The license, as the source has it:', '#', ...text.split('\n').map((line) => `# ${line}`.trimEnd())]
    : ['# The source has no license text.']
  return `${[...header(bundle, theme, where), ...body(theme), '', ...license].join('\n')}\n`
}

/** The lines of [theme]'s file after its header: the base, then every key under its table. */
function body(theme: ThemeData): string[] {
  const colors = resolve(theme)
  const lines = [`base = "${theme.base}"`]
  let section = ''
  for (const [key, { value, from }] of Object.entries(colors)) {
    const [table, name] = key.split('.')
    if (table !== section) {
      lines.push('', `# ${SECTIONS[table]}`, `[${table}]`)
      section = table
    }
    lines.push(`${name} = "${value}" # ${from}`)
  }
  return lines
}

/**
 * The version of the theme format: the keys a file has and what they take. Skiff Code refuses a list
 * whose format is higher than the one it knows, so this goes up when `reference/light.toml` changes.
 */
export const FORMAT = 2

/** The colors the app's theme list draws before a theme is downloaded: its `Themes.SWATCH`. */
export const SWATCH = ['editor.background', 'editor.foreground', 'syntax.keyword', 'syntax.string', 'syntax.definition', 'ui.accent']

/**
 * `index.json`, the list Skiff Code downloads: every theme of [bundles] in order, with the colors its
 * list draws and the size and SHA-256 of the file [files] has for it, which the app checks a download
 * against.
 */
export function index(bundles: Bundle[], files: Map<string, string>): string {
  const line = (bundle: Bundle, theme: ThemeData) => {
    const text = files.get(`${theme.id}.toml`)
    if (text === undefined) throw new Error(`${theme.id}: no file to list`)
    const bytes = Buffer.from(text, 'utf8')
    const colors = resolve(theme)
    const entry = {
      id: theme.id,
      title: theme.title,
      family: bundle.family,
      base: theme.base,
      swatch: SWATCH.map((key) => colors[key].value),
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }
    return `    ${JSON.stringify(entry)}`
  }
  const lines = bundles.flatMap((bundle) => bundle.themes.map((theme) => line(bundle, theme)))
  return `{\n  "format": ${FORMAT},\n  "themes": [\n${lines.join(',\n')}\n  ]\n}\n`
}

/** `NOTICE.md`: each bundle's source and license in full. */
export function notice(bundles: Bundle[]): string {
  const parts = [
    '# Notice',
    '',
    "The themes in `themes/` are converted from the projects below. Each one's colors were read from",
    "the source named and written into Skiff Code's theme format, with each file's comments saying",
    'what every color came from; a color the source has none for is filled from another of its colors.',
    'Nothing else of these projects is included. Each theme is under its own project\'s license, below.',
  ]
  for (const bundle of bundles) {
    parts.push(
      '',
      `## ${bundle.family}`,
      '',
      `- Themes: ${bundle.themes.map((theme) => `\`${theme.id}\``).join(', ')}`,
      `- Source: ${bundle.repository} at \`${bundle.commit}\``,
      `- License: ${bundle.license}, ${bundle.copyright}`,
      '',
      '```text',
      bundle.licenseText.trimEnd(),
      '```',
    )
  }
  return `${parts.join('\n')}\n`
}

/**
 * The keys whose contrast the table shows: the document's against `editor.background`, and the
 * sidebar's git colors against `ui.background`, which is what they are drawn on.
 */
const MEASURED = ['editor.foreground', 'syntax.comment', 'syntax.keyword', 'syntax.string', 'syntax.definition', 'syntax.type', 'syntax.literal', ...GIT_KEYS]

/** Below this, `editor.foreground` fails the run unless the theme says why; the others are only shown. */
export const MIN_CONTRAST = 4.5

/** Each [MEASURED] key's contrast against [colors]' `editor.background`, or `ui.background` for [GIT_KEYS]. */
export function contrasts(colors: Record<string, string>): Record<string, number> {
  const editor = opaqueOver(colors['editor.background'], '#000')
  const sidebar = opaqueOver(colors['ui.background'], editor)
  return Object.fromEntries(MEASURED.map((key) => {
    const under = GIT_KEYS.includes(key) ? sidebar : editor
    return [key, contrast(over(colors[key], under), under)]
  }))
}

export const ROOT = fileURLToPath(new URL('../', import.meta.url))
export const DATA_DIR = `${ROOT}scripts/data/`
export const THEMES_DIR = `${ROOT}themes/`

/** Every data file, by name, in the order `index.json` lists them. */
export function readBundles(): [string, Bundle][] {
  return readdirSync(DATA_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => [name, JSON.parse(readFileSync(DATA_DIR + name, 'utf8')) as Bundle])
}

/** The header row of the contrast table, and [theme]'s row with its `editor.foreground`'s contrast. */
const TABLE_HEAD = ['theme', ...MEASURED.map((key) => key.split('.')[1])].join('\t')
function measure(theme: ThemeData, name: string): { row: string; foreground: number } {
  const measured = contrasts(Object.fromEntries(Object.entries(resolve(theme)).map(([key, picked]) => [key, picked.value])))
  return { row: [name, ...MEASURED.map((key) => measured[key].toFixed(1))].join('\t'), foreground: measured['editor.foreground'] }
}

/** The names Skiff Code keeps for its own themes, which an imported file cannot take. */
export const RESERVED = ['system', 'light', 'dark']

/** What Skiff Code's `Themes.nameOf` takes as a theme's name: up to 64 letters, digits, ` _()-`. */
const NAME = /^[\p{L}\p{N}][\p{L}\p{N} _()-]{0,63}$/u

/**
 * The theme name the file [path] imports as, or why Skiff Code's `Import Theme` would refuse it:
 * its name is its file's, less `.toml`.
 */
export function nameOf(path: string): { name: string } | { refused: string } {
  const file = basename(path)
  if (!/\.toml$/i.test(file)) return { refused: `${file} does not end in .toml` }
  const name = file.slice(0, -'.toml'.length)
  if (!NAME.test(name) || name !== name.trim()) {
    return { refused: `"${name}" is not a name Skiff Code takes: up to 64 letters, digits, spaces, _, -, ( and ), starting with a letter or digit` }
  }
  if (RESERVED.includes(name.toLowerCase())) return { refused: `"${name}" is one of Skiff Code's own themes (${RESERVED.join(', ')})` }
  return { name }
}

/** Throws, saying what is wrong, unless [data] is a bundle with one theme that [single] can write. */
function checkOne(data: unknown): asserts data is Bundle {
  const bundle = data as Partial<Bundle>
  const text = (key: keyof Bundle) => {
    if (typeof bundle[key] !== 'string' || (key !== 'licenseText' && !(bundle[key] as string).trim())) throw new Error(`the data has no ${key}`)
  }
  for (const key of ['repository', 'commit', 'license', 'copyright', 'licenseText'] as const) text(key)
  if (!/^[0-9a-f]{40}$/.test(bundle.commit!)) throw new Error(`commit "${bundle.commit}" is not a full SHA`)
  if (!Array.isArray(bundle.themes) || bundle.themes.length !== 1) throw new Error('the data must hold exactly one theme')
  const theme = bundle.themes[0] as Partial<ThemeData>
  for (const key of ['id', 'title', 'source'] as const) {
    if (typeof theme[key] !== 'string' || !theme[key].trim()) throw new Error(`the theme has no ${key}`)
  }
  if (theme.base !== 'light' && theme.base !== 'dark') throw new Error(`base "${theme.base}" is neither light nor dark`)
  if (typeof theme.colors !== 'object' || theme.colors === null) throw new Error('the theme has no colors')
  for (const [key, picked] of Object.entries(theme.colors)) {
    if (typeof picked?.value !== 'string' || typeof picked?.from !== 'string') throw new Error(`${key} is not { value, from }`)
  }
}

/**
 * Writes the one theme of the data file [dataPath] to [outPath], a new file, and returns the
 * contrast table and anything worth saying. Throws, writing nothing, for data [checkOne] or
 * [resolve] refuses, a name `Import Theme` refuses, a file already there, a place inside the list,
 * a base its background contradicts, or an `editor.foreground` below [MIN_CONTRAST] without a reason.
 */
export function writeOne(dataPath: string, outPath: string): { table: string; notes: string[] } {
  const data: unknown = JSON.parse(readFileSync(dataPath, 'utf8'))
  checkOne(data)
  const theme = data.themes[0]
  const named = nameOf(outPath)
  if ('refused' in named) throw new Error(named.refused)
  const out = resolvePath(outPath)
  const listed = [THEMES_DIR, DATA_DIR, `${ROOT}index.json`, `${ROOT}NOTICE.md`].map((it) => resolvePath(it))
  if (listed.some((it) => out === it || out.startsWith(`${it}/`))) throw new Error(`${outPath} is part of the list; write outside it`)
  if (existsSync(out)) throw new Error(`${outPath} is already there; remove it or choose another name`)
  const text = single(data)
  const background = resolve(theme)['editor.background'].value
  const light = contrast(over(background, '#000'), '#000000') > contrast(over(background, '#000'), '#ffffff')
  if (theme.base !== (light ? 'light' : 'dark')) throw new Error(`base is ${theme.base}, but editor.background ${background} is ${light ? 'light' : 'dark'}`)
  const { row, foreground } = measure(theme, named.name)
  const notes: string[] = []
  if (foreground < MIN_CONTRAST) {
    if (!theme.lowContrast) throw new Error(`editor.foreground is ${foreground.toFixed(2)}:1, below ${MIN_CONTRAST}:1; nothing was written\n${TABLE_HEAD}\n${row}`)
    notes.push(`editor.foreground is below ${MIN_CONTRAST}:1, let be: ${theme.lowContrast}`)
  }
  const ids = readBundles().flatMap(([, bundle]) => bundle.themes.map((it) => it.id))
  const same = ids.find((id) => id === named.name.toLowerCase())
  if (same) notes.push(`"${named.name}" is also ${same} in the list: downloading that one would ask to replace this`)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, text)
  return { table: `${TABLE_HEAD}\n${row}`, notes }
}

function main(): void {
  const bundles = readBundles()
  const files = new Map<string, string>()
  const failing: string[] = []
  const rows: string[] = [TABLE_HEAD]
  for (const [name, bundle] of bundles) {
    for (const theme of bundle.themes) {
      files.set(`${theme.id}.toml`, toml(bundle, theme, name))
      const { row, foreground } = measure(theme, theme.id)
      rows.push(row)
      if (foreground >= MIN_CONTRAST) continue
      if (theme.lowContrast) console.warn(`${theme.id}: editor.foreground is below ${MIN_CONTRAST}:1, let be: ${theme.lowContrast}`)
      else failing.push(theme.id)
    }
  }
  console.log(rows.join('\n'))
  if (failing.length > 0) {
    console.error(`editor.foreground is below ${MIN_CONTRAST}:1 in ${failing.join(', ')}; nothing was written`)
    process.exit(1)
  }
  mkdirSync(THEMES_DIR, { recursive: true })
  for (const old of readdirSync(THEMES_DIR)) {
    if (old.endsWith('.toml') && !files.has(old)) rmSync(THEMES_DIR + old)
  }
  for (const [file, text] of files) writeFileSync(THEMES_DIR + file, text)
  writeFileSync(`${ROOT}index.json`, index(bundles.map(([, bundle]) => bundle), files))
  writeFileSync(`${ROOT}NOTICE.md`, notice(bundles.map(([, bundle]) => bundle)))
  console.log(`wrote ${files.size} themes, index.json and NOTICE.md`)
}

/** `--one <data> --out <file>`: [writeOne], saying what it wrote or why it did not. */
function mainOne(args: string[]): void {
  const at = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined
  }
  const data = at('--one')
  const out = at('--out')
  if (!data || !out || args.length !== 4) {
    console.error('usage: npm run themes -- --one <data file> --out <name>.toml')
    process.exit(2)
  }
  try {
    const { table, notes } = writeOne(data, out)
    console.log(table)
    for (const note of notes) console.warn(note)
    console.log(`wrote ${out}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.length === 0) main()
  else mainOne(args)
}
