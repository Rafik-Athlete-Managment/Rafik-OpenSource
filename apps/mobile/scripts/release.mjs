import { secureTooling } from '../../../scripts/tooling-security.mjs'
import { spawn, execFileSync } from 'node:child_process'
import { randomBytes, createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

secureTooling({ check: true })

const mobile = resolve(import.meta.dirname, '..')
const repo = resolve(mobile, '../..')
const args = process.argv.slice(2)
if (
  args.some((arg) => !['--init-signing', '--prepare-only', '--verify-only', '--help'].includes(arg))
)
  throw Error('Use --init-signing, --prepare-only, --verify-only, or no arguments.')
if (args.includes('--help')) {
  console.log(
    'npm run mobile:release -- --init-signing  Create a private local signing key once.\nnpm run mobile:release -- --prepare-only  Validate signing and prepare native configuration.\nnpm run mobile:release -- --verify-only  Verify an existing APK; requires RAFIK_APK_SOURCE_REVISION.\nnpm run mobile:release  Build and verify a signed ARM64/x86_64 APK; never installs or starts an emulator.',
  )
  process.exit(0)
}
const signing = join(mobile, '.signing')
const credentials = join(signing, 'signing.json')
const key = join(signing, 'rafik-release.p12')
const config = JSON.parse(readFileSync(join(mobile, 'app.json'), 'utf8')).expo
const windows = process.platform === 'win32'
const java = (name) =>
  process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', name + (windows ? '.exe' : '')) : name
async function run(executable, commandArgs, env = process.env, cwd = mobile) {
  const child = spawn(executable, commandArgs, { cwd, env, stdio: 'inherit', windowsHide: true })
  const code = await new Promise((accept, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => accept(code))
  })
  if (code !== 0) throw Error(`Command failed (${code}): ${executable}`)
}
try {
  if (args.includes('--init-signing')) {
    if (existsSync(key) || existsSync(credentials))
      throw Error('Signing material already exists; never overwrite an update key.')
    mkdirSync(signing, { recursive: true, mode: 0o700 })
    const password = randomBytes(32).toString('base64url')
    // Persist the password first so a failed/interrupted key generation cannot lose it.
    writeFileSync(
      credentials,
      JSON.stringify(
        { alias: 'rafik-release', storePassword: password, keyPassword: password },
        null,
        2,
      ) + '\n',
      { flag: 'wx', mode: 0o600 },
    )
    await run(
      java('keytool'),
      [
        '-genkeypair',
        '-noprompt',
        '-keystore',
        key,
        '-storetype',
        'PKCS12',
        '-alias',
        'rafik-release',
        '-keyalg',
        'RSA',
        '-keysize',
        '3072',
        '-validity',
        '10000',
        '-dname',
        'CN=Rafik Android Release',
        '-storepass:env',
        'RAFIK_KEYGEN_PASSWORD',
        '-keypass:env',
        'RAFIK_KEYGEN_PASSWORD',
      ],
      { ...process.env, RAFIK_KEYGEN_PASSWORD: password },
    )
    console.log(
      'Created private signing material in apps/mobile/.signing/. Back up both files privately; never commit or share them.',
    )
    process.exit(0)
  }
  if (!existsSync(credentials) || !existsSync(key))
    throw Error(
      'Run npm run mobile:release -- --init-signing once, or restore your existing apps/mobile/.signing/ backup.',
    )
  const secrets = JSON.parse(readFileSync(credentials, 'utf8'))
  if (
    ![secrets.alias, secrets.storePassword, secrets.keyPassword].every(
      (v) => typeof v === 'string' && v.length,
    )
  )
    throw Error('Invalid local signing configuration.')
  if (!Number.isInteger(config.android.versionCode) || config.android.versionCode < 1)
    throw Error('Set a positive Android versionCode in app.json.')
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    RAFIK_ANDROID_KEYSTORE: key,
    RAFIK_ANDROID_KEY_ALIAS: secrets.alias,
    RAFIK_ANDROID_STORE_PASSWORD: secrets.storePassword,
    RAFIK_ANDROID_KEY_PASSWORD: secrets.keyPassword,
    GRADLE_OPTS: `${process.env.GRADLE_OPTS || ''} -Dorg.gradle.workers.max=2 -Dorg.gradle.parallel=false`,
  }
  const output = join(repo, 'artifacts/mobile', config.version)
  const name = `Rafik-Squire-${config.version}-android.apk`
  const destination = join(output, name)
  if (!args.includes('--prepare-only') && existsSync(destination))
    throw Error(
      'An artifact for this version already exists. Preserve it or increment the version before rebuilding.',
    )
  const expectedCertificate = createHash('sha256')
    .update(
      execFileSync(
        java('keytool'),
        [
          '-exportcert',
          '-keystore',
          key,
          '-alias',
          secrets.alias,
          '-storepass:env',
          'RAFIK_ANDROID_STORE_PASSWORD',
        ],
        { env, windowsHide: true },
      ),
    )
    .digest('hex')
  const android = join(mobile, 'android')
  const verifyOnly = args.includes('--verify-only')
  if (verifyOnly && !/^[a-f0-9]{40}$/.test(process.env.RAFIK_APK_SOURCE_REVISION || ''))
    throw Error(
      'Verification-only requires RAFIK_APK_SOURCE_REVISION for the already compiled APK; it must not infer provenance from the current worktree.',
    )
  const revision = verifyOnly
    ? process.env.RAFIK_APK_SOURCE_REVISION
    : execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim()
  execFileSync('git', ['cat-file', '-e', `${revision}^{commit}`], { cwd: repo })
  const dirty = verifyOnly
    ? null
    : !!execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim()
  if (!verifyOnly) {
    if (!existsSync(join(android, 'build.gradle'))) {
      const { createRequire } = await import('node:module')
      const require = createRequire(import.meta.url)
      await run(
        process.execPath,
        [
          join(dirname(require.resolve('expo/package.json')), 'bin/cli'),
          'prebuild',
          '--platform',
          'android',
          '--no-install',
        ],
        env,
      )
    }
    await run(process.execPath, [join(mobile, 'scripts/android.mjs'), '--prepare-only'], env)
    if (args.includes('--prepare-only')) {
      console.log(
        `Prepared Squire ${config.version} (${config.android.versionCode}); no Gradle build or installation ran.`,
      )
      process.exit(0)
    }
    // cmd.exe is needed only for the fixed Windows Gradle batch entry point. No
    // user text, paths or signing secrets are interpolated into shell code.
    const gradleArgs = [
      'app:assembleRelease',
      '--max-workers=2',
      '--no-parallel',
      '--build-cache',
      '-PreactNativeArchitectures=arm64-v8a,x86_64',
    ]
    await run(
      windows ? 'cmd.exe' : './gradlew',
      windows ? ['/d', '/c', 'gradlew.bat', ...gradleArgs] : gradleArgs,
      env,
      android,
    )
  }
  const sdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    (windows ? join(process.env.LOCALAPPDATA, 'Android/Sdk') : '')
  const { readdirSync } = await import('node:fs')
  const tools = join(sdk, 'build-tools')
  const versions = readdirSync(tools)
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  if (!versions.length) throw Error('Android SDK build-tools are required for APK verification.')
  const apk = join(android, 'app/build/outputs/apk/release/app-release.apk')
  const verifier = join(tools, versions[0], windows ? 'apksigner.bat' : 'apksigner')
  // Invoke the verifier JAR directly on Windows to keep paths out of shell text.
  const verification = windows
    ? execFileSync(
        java('java'),
        [
          '-jar',
          join(tools, versions[0], 'lib/apksigner.jar'),
          'verify',
          '--verbose',
          '--print-certs',
          apk,
        ],
        { env, encoding: 'utf8', windowsHide: true },
      )
    : execFileSync(verifier, ['verify', '--verbose', '--print-certs', apk], {
        env,
        encoding: 'utf8',
      })
  const certificates = [
    ...verification.matchAll(
      /^\s*(?:Signer #\d+|V[\d.]+ Signer):? certificate SHA-256 digest: ([a-f0-9]{64})\s*$/gim,
    ),
  ].map((match) => match[1].toLowerCase())
  if (
    !/Number of signers: 1\s*(?:\r?\n|$)/.test(verification) ||
    !certificates.length ||
    certificates.some((digest) => digest !== expectedCertificate)
  )
    throw Error(
      'APK certificate does not match the configured release key; no artifact was published.',
    )
  const badging = execFileSync(
    join(tools, versions[0], windows ? 'aapt.exe' : 'aapt'),
    ['dump', 'badging', apk],
    { encoding: 'utf8', windowsHide: true },
  )
  const metadata = /^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/m.exec(
    badging,
  )
  if (
    !metadata ||
    metadata[1] !== config.android.package ||
    +metadata[2] !== config.android.versionCode ||
    metadata[3] !== config.version ||
    /application-debuggable/.test(badging)
  )
    throw Error('APK package/version/debuggable metadata does not match this release candidate.')
  const entries = execFileSync(java('jar'), ['tf', apk], {
    encoding: 'utf8',
    windowsHide: true,
  }).split(/\r?\n/)
  if (
    !entries.includes('assets/index.android.bundle') ||
    !['arm64-v8a', 'x86_64'].every((abi) =>
      entries.some((entry) => entry.startsWith(`lib/${abi}/`)),
    )
  )
    throw Error('APK is missing its JavaScript bundle or requested native architectures.')
  console.log(`APK verified; release certificate SHA-256: ${expectedCertificate}`)
  mkdirSync(output, { recursive: true })
  if (existsSync(destination))
    throw Error(
      'An artifact for this version already exists. Preserve it or increment the version before rebuilding.',
    )
  copyFileSync(apk, destination)
  const digest = createHash('sha256').update(readFileSync(destination)).digest('hex')
  writeFileSync(join(output, 'SHA256SUMS'), `${digest}  ${name}\n`)
  writeFileSync(
    join(output, 'build.json'),
    JSON.stringify(
      {
        product: 'Rafik Squire',
        version: config.version,
        versionCode: config.android.versionCode,
        package: config.android.package,
        architectures: ['arm64-v8a', 'x86_64'],
        built_at: new Date().toISOString(),
        revision,
        dirty,
        verification_only: verifyOnly,
        provenance: verifyOnly
          ? 'Operator-supplied compiled source revision; verification did not rebuild.'
          : 'Source revision captured before Gradle build.',
        certificate_sha256: expectedCertificate,
        sha256: digest,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(
    `Verified signed APK: ${destination}\nSHA-256: ${digest}\nNo device was installed, reset or uninstalled.`,
  )
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
