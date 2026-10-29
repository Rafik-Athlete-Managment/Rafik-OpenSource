import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { secureTooling } from './tooling-security.mjs'

secureTooling({ check: true })
const require = createRequire(import.meta.url)
const expo = createRequire(require.resolve('expo/package.json'))
const cliPath = expo.resolve('@expo/cli/package.json')
const cli = createRequire(cliPath)
const configPath = expo.resolve('@expo/config/package.json')
const mergeRequire = createRequire(configPath)
const merge = mergeRequire('deepmerge')
const zodPath = cli.resolve('zod/package.json')
const cliFile = (name) => resolve(dirname(cliPath), 'build/src/start/server', name)

test('deepmerge blocks unsafe source AND target keys without changing normal merges', () => {
  const symbol = Symbol('metadata')
  assert.deepEqual(
    merge({ list: [1], nested: { a: 1 }, [symbol]: 'ok' }, { list: [2], nested: { b: 2 } }),
    { list: [1, 2], nested: { a: 1, b: 2 }, [symbol]: 'ok' },
  )
  assert.deepEqual(merge({ list: [1] }, { list: [2] }, { arrayMerge: (_, b) => b }), { list: [2] })
  assert.deepEqual(merge({ n: { a: 1 } }, { n: { b: 2 } }, { customMerge: () => () => 'custom' }), {
    n: 'custom',
  })
  for (const implementation of [
    merge,
    mergeRequire(resolve(dirname(mergeRequire.resolve('deepmerge/package.json')), 'dist/umd.js')),
  ]) {
    const malicious = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"polluted":true},"safe":1}',
    )
    for (const target of [{}, Object.create(null), malicious]) {
      const result = implementation(target, malicious)
      assert.equal(Object.getPrototypeOf(result), Object.prototype)
      assert.deepEqual(Object.keys(result), ['safe'])
      assert.equal(result.polluted, undefined)
      assert.equal({}.polluted, undefined)
    }
    assert.throws(() =>
      implementation(
        new Proxy(
          {},
          {
            has() {
              throw Error('blocked')
            },
          },
        ),
        { x: 1 },
      ),
    )
  }
})

for (const mode of ['cjs', 'esm'])
  test(`Zod ${mode} rejects oversized bounded collections before reading any elements`, async () => {
    const { z } =
      mode === 'cjs'
        ? cli('zod')
        : await import(pathToFileURL(resolve(dirname(zodPath), 'index.js')))
    for (const asyncMode of [false, true]) {
      let reads = 0
      const item = z.preprocess((value) => {
        reads++
        return value
      }, z.number())
      for (const schema of [
        z.array(item).max(2),
        z.array(item).length(2),
        z.set(item).max(2),
        z.set(item).size(2),
      ]) {
        const input = schema instanceof z.ZodSet ? new Set([1, 2, 3]) : [1, 2, 3]
        const result = asyncMode ? await schema.safeParseAsync(input) : schema.safeParse(input)
        assert.equal(result.success, false)
        assert.equal(result.error.issues.length, 1)
        assert.equal(result.error.issues[0].code, 'too_big')
        assert.equal(reads, 0)
      }
      const schema = z.array(item).max(2)
      const result = asyncMode ? await schema.safeParseAsync([1, 2]) : schema.safeParse([1, 2])
      assert.equal(result.success, true)
      assert.equal(reads, 2)
    }
    const sparse = []
    sparse.length = 1_000_000
    assert.equal(z.array(z.number()).max(10).safeParse(sparse).error.issues.length, 1)
    assert.equal(z.array(z.number()).min(2).safeParse([1]).success, false)
  })

test('Expo plugin schemas and MCP parameter construction retain their Zod3 contract', () => {
  const { PluginSchema, DevToolsPluginOutputSchema } = cli(cliFile('DevToolsPlugin.schema.js'))
  const plugin = {
    packageName: 'fixture',
    packageRoot: '/fixture',
    cliExtensions: {
      description: 'Synthetic test',
      entryPoint: 'index.js',
      commands: [
        {
          name: 'run',
          title: 'Run',
          environments: ['cli', 'mcp'],
          parameters: [{ name: 'count', type: 'number' }],
        },
      ],
    },
  }
  const valid = PluginSchema.parse(plugin)
  const { createMCPDevToolsExtensionSchema } = cli(cliFile('createMCPDevToolsExtensionSchema.js'))
  const schema = createMCPDevToolsExtensionSchema(valid)
  assert.deepEqual(schema.parse({ command: 'run', count: 3 }), { command: 'run', count: 3 })
  assert.equal(schema.safeParse({ command: 'run', extra: true }).success, false)
  assert.equal(
    PluginSchema.safeParse({
      ...plugin,
      cliExtensions: { ...plugin.cliExtensions, commands: Array(129).fill(null) },
    }).error.issues.length,
    1,
  )
  assert.equal(DevToolsPluginOutputSchema.safeParse(Array(1025).fill(null)).error.issues.length, 1)
  assert.deepEqual(
    DevToolsPluginOutputSchema.parse([{ type: 'text', text: 'ok', level: 'info' }]),
    [{ type: 'text', text: 'ok', level: 'info' }],
  )
})

test('Expo output budgets bound JSON parsing, plain lines, bytes and repeated chunks', () => {
  const { DevToolsPluginCliExtensionResults: Results } = cli(
    cliFile('DevToolsPluginCliExtensionResults.js'),
  )
  const result = new Results()
  result.append('[{"type":"text","text":"ok","level":"info"}]')
  assert.equal(result.getOutput()[0].text, 'ok')
  result.append('x'.repeat(1024 * 1024))
  assert.equal(result.isTruncated(), true)
  const count = result.getOutput().length
  result.append('ignored')
  assert.equal(result.getOutput().length, count)
  assert.equal(result.parseOutputText('x'.repeat(1024 * 1024 + 1))[0].level, 'error')
  assert.equal(result.parseOutputText('x\n'.repeat(1025))[0].level, 'error')
  const unicode = new Results()
  unicode.append('ع'.repeat(600_000))
  assert.equal(unicode.isTruncated(), true)
  const many = new Results()
  for (let i = 0; i < 1100; i++) many.append('ok')
  assert.equal(many.isTruncated(), true)
  assert.ok(many.getOutput().length <= 1025)
})

test('patch application is idempotent and fails closed before any writes on unknown content/version', () => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'rafik-tooling-'))
  try {
    const manifest = JSON.parse(
      readFileSync(new URL('./tooling-security-patches.json', import.meta.url)),
    )
    const locations = {
      deepmerge: mergeRequire.resolve('deepmerge/package.json'),
      zod: zodPath,
      '@expo/cli': cliPath,
    }
    for (const [name, version] of [
      ['expo', '58.0.14'],
      ['@expo/config', '58.0.6'],
      ['@expo/cli', '58.1.11'],
      ['zod', '3.25.76'],
      ['deepmerge', '4.3.1'],
    ]) {
      const directory = resolve(fixture, 'node_modules', name)
      mkdirSync(directory, { recursive: true })
      writeFileSync(resolve(directory, 'package.json'), JSON.stringify({ name, version }))
    }
    const originals = []
    for (const patch of manifest.files) {
      let text = readFileSync(resolve(dirname(locations[patch.package]), patch.path), 'utf8')
      for (const change of [...patch.changes].reverse())
        text = text.replace(change.after, change.before)
      const path = resolve(fixture, 'node_modules', patch.package, patch.path)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, text)
      originals.push({ path, text })
    }
    assert.throws(() => secureTooling({ check: true, installationRoot: fixture }), /missing/)
    const last = originals.at(-1)
    writeFileSync(last.path, last.text + '// unexpected')
    assert.throws(
      () => secureTooling({ installationRoot: fixture }),
      /Unexpected dependency content/,
    )
    assert.equal(readFileSync(originals[0].path, 'utf8'), originals[0].text)
    writeFileSync(last.path, last.text)
    const versionPath = resolve(fixture, 'node_modules/zod/package.json')
    writeFileSync(versionPath, '{"version":"4.0.0"}')
    assert.throws(() => secureTooling({ installationRoot: fixture }), /Review security backport/)
    writeFileSync(versionPath, '{"version":"3.25.76"}')
    secureTooling({ installationRoot: fixture })
    secureTooling({ installationRoot: fixture })
    secureTooling({ check: true, installationRoot: fixture })
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})
