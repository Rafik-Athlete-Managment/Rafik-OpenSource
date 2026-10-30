import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, join, sep, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))

test('inventory output and freshness checks agree for CRLF and LF source checkouts', () => {
  // Keep fixtures beneath the repository so copied scripts resolve the installed workspaces.
  const temporary = mkdtempSync(join(root, '.frontend-inventory-test-'))
  function rewrite(dir, ending) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, item.name)
      if (item.isDirectory()) rewrite(file, ending)
      else if (/\.(vue|ts|mjs|json|css|svg)$/.test(item.name)) {
        const normalized = readFileSync(file, 'utf8').replace(/\r\n?/g, '\n')
        writeFileSync(file, normalized.replaceAll('\n', ending))
      }
    }
  }
  try {
    const outputs = []
    for (const [name, ending] of [
      ['lf', '\n'],
      ['crlf', '\r\n'],
    ]) {
      const fixture = join(temporary, name)
      const scripts = join(fixture, 'apps/frontend/scripts')
      mkdirSync(scripts, { recursive: true })
      cpSync(join(root, 'apps/frontend/src'), join(fixture, 'apps/frontend/src'), {
        recursive: true,
      })
      for (const file of [
        'frontend-inventory.mjs',
        'frontend-inventory.json',
        'frontend-navigation.json',
      ])
        cpSync(join(root, 'apps/frontend/scripts', file), join(scripts, file))
      cpSync(join(root, '.prettierrc.json'), join(fixture, '.prettierrc.json'))
      rewrite(join(fixture, 'apps/frontend'), ending)
      const sourceFile = join(
        fixture,
        'apps/frontend/src/features/institution/GroupWorkoutPanel.vue',
      )
      const original = readFileSync(sourceFile)
      const run = (args) =>
        execFileSync(process.execPath, [join(scripts, 'frontend-inventory.mjs'), ...args], {
          cwd: root,
          encoding: 'utf8',
          maxBuffer: 1024 * 1024,
        })
      assert.match(run([]), /Inventory coverage.*passed/)
      assert.match(run(['--check']), /Inventory coverage.*passed/)
      assert.deepEqual(
        readFileSync(sourceFile),
        original,
        'generation must not rewrite source files',
      )
      const generated = join(fixture, 'docs/reference/frontend')
      outputs.push(
        Object.fromEntries(
          readdirSync(generated)
            .sort()
            .map((file) => [file, readFileSync(join(generated, file), 'utf8')]),
        ),
      )
    }
    assert.deepEqual(
      outputs[0],
      outputs[1],
      'all generated inventories must be platform-independent',
    )
    assert.ok(
      outputs[0]['navigation.md'].includes('rosterSearch'),
      'cover the multiline navigation expression',
    )
  } finally {
    assert.ok(resolve(temporary).startsWith(resolve(root) + sep))
    assert.ok(basename(temporary).startsWith('.frontend-inventory-test-'))
    rmSync(temporary, { recursive: true, force: true })
  }
})
