import { secureTooling } from '../../../scripts/tooling-security.mjs'
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawn, spawnSync } from 'node:child_process'

secureTooling({ check: true })

const mobile = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const prepareOnly = args.includes('--prepare-only')
const forwarded = args.filter((arg) => arg !== '--prepare-only')

if (args.includes('--help')) {
  console.log(`Usage: npm run mobile:android -- [--prepare-only] [Expo options]
Build/install Rafik Field using local Expo. Windows builds use shorter native
staging paths, CMake path hashing and limited build parallelism. No drive mapping,
cache deletion, SDK installation or emulator-setting changes are performed.
--prepare-only  Configure the existing native project without building or launching.
--device        Ask Expo to select a connected emulator or phone.`)
  process.exit(0)
}

async function run(executable, commandArgs, env = process.env) {
  const child = spawn(executable, commandArgs, { cwd: mobile, env, stdio: 'inherit' })
  const code = await new Promise((done, reject) => {
    child.once('error', reject)
    child.once('exit', (status) => done(status ?? 1))
  })
  if (code !== 0) process.exit(code)
}

try {
  const require = createRequire(import.meta.url)
  const expo = join(dirname(require.resolve('expo/package.json')), 'bin', 'cli')
  const windows = process.platform === 'win32'
  const env = { ...process.env }
  if (windows) {
    // System properties reach the Gradle launcher and daemon without overwriting
    // generated or user-owned gradle.properties settings.
    env.GRADLE_OPTS = `${env.GRADLE_OPTS || ''} -Dorg.gradle.workers.max=2 -Dorg.gradle.parallel=false`
    const sdk =
      env.ANDROID_HOME ||
      env.ANDROID_SDK_ROOT ||
      (env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'Android', 'Sdk') : '')
    const ninja = join(sdk, 'cmake', '3.22.1', 'bin', 'ninja.exe')
    if (sdk && existsSync(ninja)) {
      const probe = spawnSync(ninja, ['--version'], { encoding: 'utf8' })
      if (probe.error) throw probe.error
      const version = probe.stdout?.trim()
      const numbers = /^(\d+)\.(\d+)/.exec(version || '')
      if (probe.status !== 0 || !numbers) throw Error(`Could not read Ninja version: ${ninja}`)
      if (+numbers[1] < 1 || (+numbers[1] === 1 && +numbers[2] < 12))
        throw Error(
          `Ninja ${version} is too old for reliable Windows long-path builds. Update ${ninja} to 1.12 or newer; see docs/development/android.md. No build was started.`,
        )
      console.log(`Ninja ${version}; Gradle workers: 2; parallel projects: off.`)
    }
  }
  const gradle = join(mobile, 'android', 'build.gradle')
  if (!existsSync(gradle)) {
    if (prepareOnly)
      throw Error(
        'No generated Android project exists. Run npm run mobile:android first to generate it.',
      )
    await run(process.execPath, [expo, 'prebuild', '--platform', 'android', '--no-install'], env)
  }
  {
    const marker = '// Rafik Android development build helper'
    const source = readFileSync(gradle, 'utf8')
    const applyLine = "apply from: new File(rootDir, '../scripts/android-build.gradle')"
    // React Native's root plugin can evaluate :app early. Register our plugin
    // hooks before that plugin runs, not at the end of the generated file.
    const original = source
      .split(/\r?\n/)
      .filter((line) => line !== marker && line !== applyLine)
      .join('\n')
      .trim()
    const prepared = `${marker}\n${applyLine}\n\n${original}\n`
    if (source !== prepared) writeFileSync(gradle, prepared)
    console.log(
      'Native helper applied. Windows app staging: <user-home>/.rf-cxx/<checkout>/app; library staging: %TEMP%/rf-cxx/<checkout>/<module>; object path limit: 256.',
    )
  }
  const appGradle = join(mobile, 'android/app/build.gradle')
  const releaseLine = "apply from: new File(rootDir, '../scripts/android-release.gradle')"
  const appSource = readFileSync(appGradle, 'utf8')
  if (!appSource.includes(releaseLine))
    writeFileSync(appGradle, `${appSource.trimEnd()}\n\n${releaseLine}\n`)
  for (const [source, target] of [
    ['AndroidManifest.release.xml', 'src/release/AndroidManifest.xml'],
    ['network-security.xml', 'src/release/res/xml/rafik_network_security.xml'],
  ]) {
    const destination = join(mobile, 'android/app', target)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(join(mobile, 'scripts', source), destination)
  }
  // Maintained launcher assets override generated placeholders after every prebuild.
  for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    const source = join(mobile, 'assets/android-icons', 'mipmap-' + density, 'ic_launcher.png')
    if (!existsSync(source)) throw Error('Missing maintained launcher icon: ' + source)
    const resource = join(mobile, 'android/app/src/main/res', 'mipmap-' + density)
    mkdirSync(resource, { recursive: true })
    for (const name of ['ic_launcher', 'ic_launcher_round']) {
      // AAPT cannot keep PNG and WebP resources with the same resource name.
      rmSync(join(resource, name + '.webp'), { force: true })
      copyFileSync(source, join(resource, name + '.png'))
    }
  }
  if (prepareOnly) {
    console.log('Android build configuration prepared. No build, emulator or Metro was started.')
  } else {
    await run(process.execPath, [expo, 'run:android', ...forwarded], env)
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
