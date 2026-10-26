// The themes are written by `scripts/generate.ts` from their data files, and committed. These hold
// what is committed to being what the script writes, and the script to the rules it writes by.
/// <reference types="node" />
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  type Bundle,
  type ThemeData,
  DATA_DIR,
  FALLBACK,
  FORMAT,
  MIN_CONTRAST,
  REPOSITORY,
  ROOT,
  SWATCH,
  THEMES_DIR,
  contrast,
  contrasts,
  index,
  nameOf,
  notice,
  over,
  readBundles,
  resolve,
  toml,
  writeOne,
} from '../scripts/generate'
import { type Dump, GROUPS, SOURCES as NEOVIM_SOURCES, fromNeovim } from '../scripts/neovim'
import { fromVscode, parseJsonc, tokenColor } from '../scripts/vscode'

const committed = (name: string) => readFileSync(THEMES_DIR + name, 'utf8')
const atRoot = (name: string) => readFileSync(ROOT + name, 'utf8')
const tomls = () => readdirSync(THEMES_DIR).filter((name) => name.endsWith('.toml'))

/** A theme file's colors, `section.name` → value. */
function colorsOf(text: string): Record<string, string> {
  const colors: Record<string, string> = {}
  let section = ''
  for (const line of text.split('\n')) {
    const header = /^\[(\w+)\]/.exec(line)
    if (header) section = header[1]
    const pair = /^(\w+) = "([^"]*)"/.exec(line)
    if (pair && section) colors[`${section}.${pair[1]}`] = pair[2]
  }
  return colors
}

const bundles = readBundles()

/** A theme with only what nothing stands in for, each named after its key. */
function bare(colors: Record<string, string> = {}): ThemeData {
  const given: Record<string, string> = {
    'editor.background': '#101010',
    'editor.foreground': '#e0e0e0',
    'syntax.keyword': '#a0a0ff',
    'syntax.literal': '#ffa0a0',
    'syntax.string': '#a0ffa0',
    'syntax.definition': '#a0ffff',
    'syntax.type': '#ffffa0',
    'syntax.comment': '#808080',
    'syntax.invalid': '#ff0000',
    'syntax.warning': '#ffaa00',
    'diff.added': '#00ff00',
    'diff.removed': '#ff0000',
    'diff.changed': '#0000ff',
    'ui.border': '#333333',
    'ui.subtle': '#222222',
    ...colors,
  }
  return {
    id: 'bare',
    title: 'Bare',
    base: 'dark',
    source: 'nowhere',
    colors: Object.fromEntries(Object.entries(given).map(([key, value]) => [key, { value, from: key }])),
  }
}

describe('the themes', () => {
  test('are what the script writes from their data', () => {
    expect(bundles.length).toBeGreaterThan(0)
    const files = new Map<string, string>()
    for (const [name, bundle] of bundles) {
      for (const theme of bundle.themes) {
        const text = toml(bundle, theme, name)
        expect(committed(`${theme.id}.toml`), theme.id).toBe(text)
        files.set(`${theme.id}.toml`, text)
      }
    }
    const all = bundles.map(([, bundle]) => bundle)
    expect(atRoot('index.json')).toBe(index(all, files))
    expect(atRoot('NOTICE.md')).toBe(notice(all))
  })

  test('are every file in themes/, and nothing more', () => {
    const written = bundles.flatMap(([, bundle]) => bundle.themes.map((theme) => `${theme.id}.toml`))
    expect(readdirSync(THEMES_DIR).sort()).toEqual(written.sort())
  })

  test('each say where they came from and under what license', () => {
    for (const [, bundle] of bundles) {
      for (const theme of bundle.themes) {
        const head = committed(`${theme.id}.toml`).split('\n').slice(0, 6).join('\n')
        expect(head, theme.id).toContain(`# ${theme.title}, converted to a Skiff Code theme.`)
        expect(head, theme.id).toContain(`${bundle.repository} at ${bundle.commit}`)
        expect(head, theme.id).toMatch(/ at [0-9a-f]{40},\n/)
        expect(head, theme.id).toContain(`# License: ${bundle.license}, ${bundle.copyright}.`)
        // The file is downloaded and exported alone, so it says where the license text is.
        expect(head, theme.id).toContain(`NOTICE.md of\n#   ${REPOSITORY}`)
      }
    }
  })

  test('have each license in full in NOTICE.md', () => {
    const text = atRoot('NOTICE.md')
    for (const [, bundle] of bundles) {
      expect(text).toContain(`## ${bundle.family}\n`)
      expect(text).toContain(bundle.licenseText.trimEnd())
      expect(bundle.licenseText.length).toBeGreaterThan(200)
    }
  })

  test(`have editor.foreground at ${MIN_CONTRAST}:1 or more over editor.background`, () => {
    const files = tomls()
    expect(files.length).toBeGreaterThan(0)
    const excused = new Set(bundles.flatMap(([, bundle]) => bundle.themes.filter((theme) => theme.lowContrast).map((theme) => `${theme.id}.toml`)))
    for (const name of files) {
      const measured = contrasts(colorsOf(committed(name)))['editor.foreground']
      // A theme let be below needs to be: the reason goes when the source's colors change.
      if (excused.has(name)) expect(measured, name).toBeLessThan(MIN_CONTRAST)
      else expect(measured, name).toBeGreaterThanOrEqual(MIN_CONTRAST)
    }
  })

  test('are light when their background is nearer white than black, and dark when not', () => {
    for (const name of tomls()) {
      const text = committed(name)
      const background = colorsOf(text)['editor.background']
      const light = contrast(background, '#000000') > contrast(background, '#ffffff')
      expect(/^base = "(\w+)"/m.exec(text)?.[1], name).toBe(light ? 'light' : 'dark')
    }
  })

  test('have ids the settings file can name, and titles of their own', () => {
    const themes = bundles.flatMap(([, bundle]) => bundle.themes)
    for (const theme of themes) expect(theme.id).toMatch(/^[a-z][a-z0-9-]*$/)
    expect(new Set(themes.map((theme) => theme.id)).size).toBe(themes.length)
    expect(new Set(themes.map((theme) => theme.title)).size).toBe(themes.length)
  })

  test("leave Skiff Code's reserved names alone", () => {
    const ids = bundles.flatMap(([, bundle]) => bundle.themes.map((theme) => theme.id))
    for (const reserved of ['system', 'light', 'dark']) expect(ids).not.toContain(reserved)
  })
})

describe('index.json', () => {
  const catalog = JSON.parse(atRoot('index.json')) as {
    format: number
    themes: { id: string; title: string; family: string; base: string; swatch: string[]; size: number; sha256: string }[]
  }

  test(`is format ${FORMAT}, listing every theme in themes/ once`, () => {
    expect(catalog.format).toBe(FORMAT)
    expect(catalog.themes.map((entry) => `${entry.id}.toml`).sort()).toEqual(tomls().sort())
  })

  test('gives each file its size and SHA-256, which the app checks a download against', () => {
    for (const entry of catalog.themes) {
      const bytes = readFileSync(`${THEMES_DIR}${entry.id}.toml`)
      expect(entry.size, entry.id).toBe(bytes.length)
      expect(entry.sha256, entry.id).toBe(createHash('sha256').update(bytes).digest('hex'))
    }
  })

  test("gives each theme the swatch its file's colors make, and the file's base", () => {
    for (const entry of catalog.themes) {
      const text = committed(`${entry.id}.toml`)
      const colors = colorsOf(text)
      expect(entry.swatch, entry.id).toEqual(SWATCH.map((key) => colors[key]))
      expect(entry.base, entry.id).toBe(/^base = "(\w+)"/m.exec(text)?.[1])
    }
  })

  test('has ids the app takes', () => {
    for (const entry of catalog.themes) expect(entry.id).toMatch(/^[a-z][a-z0-9-]{0,63}$/)
  })
})

describe('the README', () => {
  test('names every theme and links every source', () => {
    const text = atRoot('README.md')
    for (const [, bundle] of bundles) {
      expect(text, bundle.family).toContain(bundle.repository)
      for (const theme of bundle.themes) expect(text, theme.id).toContain(`\`${theme.id}\``)
    }
  })
})

describe('the script', () => {
  test("knows every key the app's own light theme has, in its order", () => {
    expect(Object.keys(FALLBACK)).toEqual(Object.keys(colorsOf(atRoot('reference/light.toml'))))
  })

  test('fills a key the source lacks from the one the table names, saying so', () => {
    const colors = resolve(bare())
    expect(colors['ui.background']).toEqual({ value: '#101010', from: 'none in the source: editor.background' })
    // Through a chain: faint from muted, muted from comment.
    expect(colors['ui.faint']).toEqual({ value: '#808080', from: 'none in the source: ui.muted' })
    expect(colors['syntax.atom'].value).toBe('#ffa0a0')
    expect(colors['editor.selection'].value).toBe('#222222')
    expect(colors['syntax.property'].value).toBe('#e0e0e0')
    expect(Object.keys(colors)).toEqual(Object.keys(FALLBACK))
  })

  test('makes a scrim from the background at a fixed alpha', () => {
    expect(resolve(bare())['ui.scrim'].value).toBe('#10101099')
    expect(resolve(bare({ 'editor.background': '#abc' }))['ui.scrim'].value).toBe('#aabbcc99')
  })

  test('keeps alpha everywhere but diff, which it draws over the background', () => {
    const colors = resolve(bare({ 'editor.selection': '#ffffff40', 'diff.added': '#00ff0080' }))
    expect(colors['editor.selection'].value).toBe('#ffffff40')
    expect(colors['diff.added']).toEqual({ value: over('#00ff0080', '#101010'), from: 'diff.added, over editor.background' })
    expect(colors['diff.added'].value).toBe('#088808')
    expect(colors['diff.removed'].value).toBe('#ff0000')
  })

  test("takes the sidebar's git colors from the diff colors, drawn over the sidebar when they are not opaque", () => {
    const filled = resolve(bare({ 'ui.background': '#ffffff', 'diff.changed': '#0000ff80' }))
    expect(filled['ui.git_untracked']).toEqual({ value: filled['diff.added'].value, from: 'none in the source: diff.added' })
    // diff.changed itself is drawn over editor.background; the git color stands on ui.background.
    expect(filled['ui.git_modified']).toEqual({
      value: over('#0000ff80', '#ffffff'),
      from: 'none in the source: diff.changed, over ui.background',
    })
    const own = resolve(bare({ 'ui.background': '#000000', 'ui.git_modified': '#ffffff80' }))
    expect(own['ui.git_modified']).toEqual({ value: '#808080', from: 'ui.git_modified, over ui.background' })
  })

  test("measures the sidebar's git colors against ui.background, and the rest against editor.background", () => {
    const measured = contrasts(Object.fromEntries(Object.entries(resolve(bare({
      'ui.background': '#ffffff', 'ui.git_modified': '#000000', 'editor.foreground': '#ffffff',
    }))).map(([key, picked]) => [key, picked.value])))
    expect(measured['ui.git_modified']).toBeCloseTo(21, 5)
    expect(measured['editor.foreground']).toBeCloseTo(contrast('#ffffff', '#101010'), 5)
  })

  test('refuses a theme missing a key nothing stands in for, a color that is not one, or a key no file has', () => {
    const missing = bare()
    delete missing.colors['syntax.keyword']
    expect(() => resolve(missing)).toThrow('bare: the source gives no syntax.keyword')
    expect(() => resolve(bare({ 'syntax.string': 'green' }))).toThrow('"green" is not a color')
    expect(() => resolve(bare({ 'syntax.strings': '#000' }))).toThrow('syntax.strings is not a theme key')
  })

  test('refuses two keys that only stand in for each other', () => {
    const neither = bare()
    delete neither.colors['ui.border']
    expect(() => resolve(neither)).toThrow('neither ui.border nor editor.gutter_border')
  })

  test("measures WCAG's contrast", () => {
    expect(contrast('#000', '#fff')).toBeCloseTo(21, 5)
    expect(contrast('#777', '#fff')).toBeCloseTo(4.48, 2)
    expect(contrast('#123456', '#123456')).toBe(1)
  })

  test('writes a key per line with where it came from, under the comment that says what the table is for', () => {
    const bundle: Bundle = {
      family: 'Bare',
      repository: 'https://example.com/bare',
      commit: '0'.repeat(40),
      license: 'MIT',
      copyright: 'Copyright (c) Nobody',
      licenseText: 'text',
      themes: [bare()],
    }
    const text = toml(bundle, bare(), 'bare.json')
    expect(text).toContain('base = "dark"\n\n# The menu, the sidebar')
    expect(text).toContain('[ui]\nbackground = "#101010" # none in the source: editor.background\n')
    expect(text).toContain('[diff]\nadded = "#00ff00" # diff.added\n')
    expect(colorsOf(text)['syntax.keyword']).toBe('#a0a0ff')
  })
})

describe('one theme outside the list', () => {
  let dir = ''
  beforeEach(() => {
    dir = mkdtempSync(`${tmpdir()}/theme-one-`)
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  /** A bundle of [theme] alone, as /theme-convert writes it to its scratchpad. */
  const one = (theme: ThemeData, extra: Partial<Bundle> = {}): Bundle => ({
    family: 'Bare',
    repository: 'https://example.com/bare',
    commit: 'a'.repeat(40),
    license: 'MIT',
    copyright: 'Copyright (c) Nobody',
    licenseText: 'MIT License\n\nCopyright (c) Nobody\n\nPermission is hereby granted.\n',
    themes: [theme],
    ...extra,
  })
  const data = (bundle: unknown) => {
    const path = `${dir}/data.json`
    writeFileSync(path, JSON.stringify(bundle))
    return path
  }

  test('writes the same file the list does from the same data, but for where the license is', () => {
    const [name, bundle] = bundles[0]
    const theme = bundle.themes[0]
    writeOne(data({ ...bundle, themes: [theme] }), `${dir}/Mine.toml`)
    const listed = toml(bundle, theme, name).split('\n')
    const own = readFileSync(`${dir}/Mine.toml`, 'utf8').split('\n')
    expect(own.slice(0, 3)).toEqual(listed.slice(0, 3))
    expect(own[3]).toBe(`# License: ${bundle.license}, ${bundle.copyright}. The full text is at the end of this file,`)
    expect(own[4]).toContain(REPOSITORY)
    // Everything from the last header line to the last color.
    expect(own.slice(5, listed.length - 1)).toEqual(listed.slice(5, -1))
    expect(colorsOf(own.join('\n'))).toEqual(colorsOf(listed.join('\n')))
    // The license follows, in full, as comments.
    const end = own.slice(listed.length - 1).join('\n')
    for (const line of bundle.licenseText.trimEnd().split('\n')) expect(end).toContain(`# ${line}`.trimEnd())
    expect(own.slice(listed.length - 1).every((line) => line === '' || line.startsWith('#'))).toBe(true)
  })

  test('touches nothing of the list', () => {
    const snapshot = () =>
      [THEMES_DIR, DATA_DIR].flatMap((at) => readdirSync(at).sort().map((file) => `${at}${file} ${readFileSync(at + file, 'utf8')}`))
        .concat(['index.json', 'NOTICE.md'].map(atRoot))
    const before = snapshot()
    writeOne(data(one(bare())), `${dir}/Bare.toml`)
    expect(snapshot()).toEqual(before)
    expect(readdirSync(dir).sort()).toEqual(['Bare.toml', 'data.json'])
  })

  test('says when the source has no license text', () => {
    writeOne(data(one(bare(), { license: 'none', licenseText: '' })), `${dir}/Bare.toml`)
    expect(readFileSync(`${dir}/Bare.toml`, 'utf8')).toMatch(/\n# The source has no license text\.\n$/)
  })

  test('writes nothing for data that is wrong', () => {
    const missing = bare()
    delete missing.colors['syntax.keyword']
    const cases: [unknown, string][] = [
      [one(missing), 'the source gives no syntax.keyword'],
      [one(bare({ 'syntax.string': 'green' })), '"green" is not a color'],
      [one(bare({ 'syntax.strings': '#000' })), 'syntax.strings is not a theme key'],
      [{ ...one(bare()), themes: [bare(), bare()] }, 'exactly one theme'],
      [one(bare(), { commit: 'abc123' }), 'not a full SHA'],
      [{ ...one(bare()), repository: undefined }, 'no repository'],
      [one({ ...bare(), base: 'dim' as 'dark' }), 'neither light nor dark'],
      [one({ ...bare(), base: 'light' }), 'editor.background #101010 is dark'],
      [one(bare({ 'editor.foreground': '#202020' })), 'below 4.5:1'],
    ]
    for (const [bundle, error] of cases) {
      expect(() => writeOne(data(bundle), `${dir}/Bare.toml`), error).toThrow(error)
      expect(existsSync(`${dir}/Bare.toml`), error).toBe(false)
    }
  })

  test('lets a low contrast be when the data says why', () => {
    const theme = { ...bare({ 'editor.foreground': '#202020' }), lowContrast: 'the source draws it so' }
    const { table, notes } = writeOne(data(one(theme)), `${dir}/Bare.toml`)
    expect(notes).toEqual(['editor.foreground is below 4.5:1, let be: the source draws it so'])
    expect(table.split('\n')[1]).toMatch(/^Bare\t1\.\d\t/)
  })

  test('refuses a name Import Theme refuses, a file already there, and a place in the list', () => {
    const path = data(one(bare()))
    for (const name of ['light.toml', 'System.toml', 'Dark.TOML', 'bare.json', 'bare.toml.txt', ' bare.toml', 'bare .toml', 'bare!.toml', `${'a'.repeat(65)}.toml`]) {
      expect(() => writeOne(path, `${dir}/${name}`), name).toThrow()
    }
    expect(readdirSync(dir)).toEqual(['data.json'])
    writeFileSync(`${dir}/Bare.toml`, 'mine')
    expect(() => writeOne(path, `${dir}/Bare.toml`)).toThrow('already there')
    expect(readFileSync(`${dir}/Bare.toml`, 'utf8')).toBe('mine')
    expect(() => writeOne(path, `${THEMES_DIR}bare-new.toml`)).toThrow('part of the list')
    expect(existsSync(`${THEMES_DIR}bare-new.toml`)).toBe(false)
  })

  test("takes the names Skiff Code's nameOf takes", () => {
    for (const name of ['Nord', 'nightfox (dusk)', '나의 테마', 'a_b-c', 'a'.repeat(64)]) {
      expect(nameOf(`/x/${name}.toml`), name).toEqual({ name })
    }
    expect(nameOf('/x/Light.toml')).toEqual({ refused: expect.stringContaining("Skiff Code's own themes") })
  })

  test('says when the name is also one in the list', () => {
    const { notes } = writeOne(data(one(bare())), `${dir}/${bundles[0][1].themes[0].id}.toml`)
    expect(notes.join('\n')).toContain('in the list: downloading that one would ask to replace this')
  })

  test('is what npm run themes -- --one writes', () => {
    const path = data(one(bare()))
    const output = execFileSync('node', ['scripts/generate.ts', '--one', path, '--out', `${dir}/sub/Bare.toml`], { cwd: ROOT, encoding: 'utf8' })
    expect(output).toContain(`wrote ${dir}/sub/Bare.toml`)
    expect(output).toMatch(/^theme\t/)
    expect(readFileSync(`${dir}/sub/Bare.toml`, 'utf8')).toContain('[diff]\nadded = "#00ff00" # diff.added\n')
    expect(() => execFileSync('node', ['scripts/generate.ts', '--one', path], { cwd: ROOT, stdio: 'pipe' })).toThrow()
  })
})

describe("reading a VS Code theme's tokens", () => {
  const rules = [
    { scope: 'keyword', settings: { foreground: '#111111' } },
    { scope: ['keyword.control', 'storage'], settings: { foreground: '#222222' } },
    { scope: 'meta.function keyword.control.flow', settings: { foreground: '#333333' } },
    { scope: 'string, constant.numeric', settings: { foreground: '#444444' } },
    { scope: 'string', settings: { foreground: '#555555' } },
    { scope: 'comment', settings: { fontStyle: 'italic' } },
  ]

  test('takes the deepest selector that is the scope or a parent of it', () => {
    expect(tokenColor(rules, 'keyword.control.flow')).toEqual({ value: '#222222', from: 'token keyword.control (for keyword.control.flow)' })
    expect(tokenColor(rules, 'keyword.operator')?.value).toBe('#111111')
  })

  test('lets a later rule win a tie, and passes over a selector that needs a parent scope', () => {
    expect(tokenColor(rules, 'string.quoted')?.value).toBe('#555555')
    expect(tokenColor(rules, 'constant.numeric.integer')?.value).toBe('#444444')
  })

  test('finds nothing for a scope no rule colors', () => {
    expect(tokenColor(rules, 'comment.line')).toBeNull()
    expect(tokenColor(rules, 'keywords')).toBeNull()
  })
})

describe('reading a VS Code theme', () => {
  test('takes JSONC: comments and trailing commas, but not inside strings', () => {
    const text = '{\n  // the name\n  "name": "a // b", /* c */\n  "colors": { "x": "#fff", },\n}'
    expect(parseJsonc(text)).toEqual({ name: 'a // b', colors: { x: '#fff' } })
  })

  test("falls back to what VS Code draws for a color the theme leaves out, for the theme's kind", () => {
    const dark = fromVscode({ colors: { 'editorError.foreground': '#AA0000' } }).colors
    expect(dark['diff.added']).toEqual({ value: '#487e02', from: "editorGutter.addedBackground: VS Code's default for a dark theme" })
    expect(dark['diff.removed']).toEqual({ value: '#aa0000', from: "editorGutter.deletedBackground: VS Code's default, editorError.foreground" })
    const light = fromVscode({ type: 'light', colors: {} }).colors
    expect(light['diff.removed'].value).toBe('#e51400')
    // From the built-in git extension rather than core, read at the same commit.
    expect(dark['ui.git_modified'].value).toBe('#e2c08d')
    expect(light['ui.git_untracked']).toEqual({ value: '#007100', from: "gitDecoration.untrackedResourceForeground: VS Code's default for a light theme" })
    expect(light['editor.cursor'].value).toBe('#000000')
  })

  test("reads the theme's own sources before any default, and takes no default for an invisible color", () => {
    const colors = fromVscode({ colors: { 'panel.border': '#0000', 'editorWidget.border': '#123456' } }).colors
    expect(colors['ui.border']).toEqual({ value: '#123456', from: 'editorWidget.border' })
    // The theme hid its panel border on purpose; VS Code draws none, so nothing is read.
    expect(fromVscode({ colors: { 'panel.border': '#0000' } }).colors['ui.border']).toBeUndefined()
    expect(fromVscode({ colors: {} }).colors['ui.border'].value).toBe('#80808059')
  })

  test('takes only an opaque accent', () => {
    const colors = fromVscode({ colors: { focusBorder: '#6e6a8633', 'button.background': '#ebbcba' } }).colors
    expect(colors['ui.accent']).toEqual({ value: '#ebbcba', from: 'button.background' })
    expect(fromVscode({ colors: { focusBorder: '#6e6a86ff' } }).colors['ui.accent'].value).toBe('#6e6a86ff')
  })
})

describe("reading a Neovim colorscheme's groups", () => {
  const dump: Dump = {
    background: 'light',
    groups: {
      Normal: { fg: '#111111', bg: '#eeeeee' },
      '@keyword': { fg: '#222222' },
      Keyword: { fg: '#333333' },
      '@number': { fg: '#444444', via: 'Constant' },
      PmenuSel: { fg: '#eeeeee', bg: '#111111', reverse: true },
      NormalFloat: {},
    },
  }

  test('takes the first group that has the color, saying where its links ended and that it was reversed', () => {
    const { base, colors } = fromNeovim(dump)
    expect(base).toBe('light')
    expect(colors['editor.background']).toEqual({ value: '#eeeeee', from: 'Normal bg' })
    expect(colors['syntax.keyword']).toEqual({ value: '#222222', from: '@keyword fg' })
    expect(colors['syntax.literal']).toEqual({ value: '#444444', from: '@number fg (via Constant)' })
    expect(colors['ui.strong_background']).toEqual({ value: '#111111', from: 'PmenuSel bg (reversed)' })
  })

  test("is light by its background's color, not by what the colorscheme left 'background'", () => {
    expect(fromNeovim({ ...dump, background: 'dark' }).base).toBe('light')
    expect(fromNeovim({ background: 'light', groups: { Normal: { bg: '#202020' } } }).base).toBe('dark')
    expect(fromNeovim({ background: 'light', groups: {} }).base).toBe('light')
  })

  test('leaves out a key no group colors, for the table to fill', () => {
    const { colors } = fromNeovim(dump)
    expect(colors['ui.background']).toBeUndefined()
    expect(colors['syntax.string']).toBeUndefined()
  })

  test('reads a group for every key the files have, and each group once', () => {
    expect(Object.keys(NEOVIM_SOURCES)).toEqual(Object.keys(FALLBACK).filter((key) => key !== 'ui.scrim'))
    expect(new Set(GROUPS).size).toBe(GROUPS.length)
  })
})
