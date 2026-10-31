import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const digest = (value) => createHash('sha256').update(value).digest('hex')

// Verify the complete plan before writing; upgrades must be reviewed explicitly.
export function secureTooling({ check = false, installationRoot = root } = {}) {
  const require = createRequire(resolve(installationRoot, 'package.json'))
  let expo
  try {
    expo = require.resolve('expo/package.json')
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error
    console.log('Expo security backports: not needed in this scoped installation.')
    return
  }
  const fromExpo = createRequire(expo)
  const cli = fromExpo.resolve('@expo/cli/package.json')
  const config = fromExpo.resolve('@expo/config/package.json')
  const locations = {
    '@expo/cli': cli,
    deepmerge: createRequire(config).resolve('deepmerge/package.json'),
    zod: createRequire(cli).resolve('zod/package.json'),
  }
  const manifest = JSON.parse(
    readFileSync(new URL('./tooling-security-patches.json', import.meta.url)),
  )
  const plan = manifest.files.map((patch) => {
    const packageFile = locations[patch.package]
    const version = JSON.parse(readFileSync(packageFile)).version
    if (version !== patch.version)
      throw Error(`Review security backport for ${patch.package}@${version}`)
    const file = resolve(dirname(packageFile), patch.path)
    const original = readFileSync(file, 'utf8').replaceAll('\r\n', '\n')
    const hash = digest(original)
    if (hash === patch.patchedSha256) return { file, pending: false }
    if (hash !== patch.originalSha256) throw Error(`Unexpected dependency content: ${file}`)
    let patched = original
    for (const { before, after } of patch.changes) {
      if (patched.split(before).length !== 2) throw Error(`Ambiguous security patch: ${file}`)
      patched = patched.replace(before, after)
    }
    if (digest(patched) !== patch.patchedSha256) throw Error(`Invalid security patch: ${file}`)
    return { file, patched, pending: true }
  })
  if (check && plan.some((item) => item.pending)) {
    throw Error('Expo security backports missing. Run npm run security:patch before using Expo.')
  }
  if (!check) for (const item of plan) if (item.pending) writeFileSync(item.file, item.patched)
  console.log(`Expo security backports: ${plan.length} files verified${check ? '' : '/applied'}.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  secureTooling({ check: process.argv.includes('--check') })
}
