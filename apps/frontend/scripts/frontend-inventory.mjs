import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import ts from 'typescript'
import { format, resolveConfig } from 'prettier'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseTemplate } from '@vue/compiler-dom'
import { createRouter, createMemoryHistory } from 'vue-router'

// Source inventory only: no browser, API, database or application lifecycle hooks run.
const root = fileURLToPath(new URL('../../../', import.meta.url))
const source = resolve(root, 'apps/frontend/src')
const output = resolve(root, 'docs/reference/frontend')
const posix = (p) => p.split(sep).join('/')
const short = (p) => posix(relative(source, p))
const walk = (dir) =>
  readdirSync(dir)
    .sort()
    .flatMap((n) => {
      const p = resolve(dir, n)
      return statSync(p).isDirectory() ? walk(p) : [p]
    })
const files = walk(source).filter((p) => /\.(vue|ts)$/.test(p))
const vue = files.filter((p) => p.endsWith('.vue'))
const metadata = JSON.parse(
  readFileSync(new URL('./frontend-inventory.json', import.meta.url), 'utf8'),
)
const issues = []
const unique = (values) => [...new Set(values)].sort()
const link = (p) => `[${short(p)}](../../../apps/frontend/src/${short(p)})`
const text = (value) =>
  String(value).replaceAll('|', '\\|').replace(/\r\n?/g, '\n').replaceAll('\n', ' ')
const sourceLink = (p, line) => `${link(p)}:${line}`
const resolveLocal = (p, name) => {
  const base = resolve(dirname(p), name)
  return [base, base + '.ts', base + '.vue', base + '.json', resolve(base, 'index.ts')].find(
    (f) => existsSync(f) && statSync(f).isFile(),
  )
}
const records = new Map()
for (const file of files) {
  // AST expression text must be identical for Windows CRLF and Unix LF checkouts.
  const raw = readFileSync(file, 'utf8').replace(/\r\n?/g, '\n')
  const descriptor = file.endsWith('.vue') ? parseSfc(raw).descriptor : undefined
  const script = descriptor
    ? [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join('\n')
    : raw
  const ast = ts.createSourceFile(
    file + '.ts',
    script,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const imports = []
  const bindings = new Map()
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const name = node.moduleSpecifier.text
      if (name.startsWith('.')) {
        const target = resolveLocal(file, name)
        if (target) {
          imports.push(target)
          if (node.importClause?.name) bindings.set(node.importClause.name.text, target)
        } else if (!/\.(css|svg|png|webp)$/.test(name))
          issues.push(`Unresolved local import: ${short(file)} → ${name}`)
      }
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const target = resolveLocal(file, node.arguments[0].text)
      if (target) imports.push(target)
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  const template = descriptor?.template?.content || ''
  const used = new Set()
  const usages = []
  const scanTemplate = (node) => {
    if (node.type === 1) {
      const binding = [...bindings.keys()].find(
        (key) =>
          key === node.tag ||
          key.replace(/[A-Z]/g, (s) => '-' + s.toLowerCase()).replace(/^-/, '') === node.tag,
      )
      if (binding) used.add(bindings.get(binding))
      for (const attr of node.props || []) {
        if (attr.type === 7 && attr.name === 'bind' && attr.arg?.content === 'is') {
          for (const [name, target] of bindings)
            if (new RegExp(`\\b${name}\\b`).test(attr.exp?.content || '')) used.add(target)
        }
        if (['RouterLink', 'router-link', 'a'].includes(node.tag)) {
          const name = attr.type === 6 ? attr.name : attr.arg?.content
          if (['to', 'href'].includes(name))
            usages.push({
              expression:
                attr.type === 6
                  ? JSON.stringify(attr.value?.content || '')
                  : attr.exp?.content || '',
              kind: node.tag === 'a' ? 'anchor' : 'RouterLink',
              line: (descriptor?.template?.loc.start.line || 1) + attr.loc.start.line - 1,
            })
        }
      }
    }
    for (const child of node.children || []) scanTemplate(child)
  }
  if (template) scanTemplate(parseTemplate(template))
  // Script-owned navigation; data-driven destinations are retained as explicit review entries.
  const scanCalls = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      /^(router|window|location)(\.|$)/.test(node.expression.expression.getText(ast)) &&
      ['push', 'replace', 'open', 'assign'].includes(node.expression.name.text)
    ) {
      usages.push({
        expression: node.arguments[0]?.getText(ast) || '',
        kind: node.expression.getText(ast),
        line:
          (descriptor?.scriptSetup?.loc.start.line || 1) +
          ast.getLineAndCharacterOfPosition(node.getStart(ast)).line,
      })
    }
    ts.forEachChild(node, scanCalls)
  }
  scanCalls(ast)
  records.set(file, { raw, script, imports: unique(imports), used: unique(used), usages, ast })
}

// Evaluate only route declarations with inert router factories. Hooks are registered, never run.
// This expands the actual mapped sections and DEV branch instead of duplicating route paths.
const routerFile = resolve(source, 'app/router.ts')
const routerSource = records.get(routerFile).raw
const routerAst = ts.createSourceFile('router.ts', routerSource, ts.ScriptTarget.Latest, true)
let stripped = routerSource
for (const node of [...routerAst.statements].reverse()) {
  if (ts.isImportDeclaration(node) || ts.isExportAssignment(node))
    stripped = stripped.slice(0, node.pos) + stripped.slice(node.end)
}
stripped = stripped.replaceAll('import.meta.env.DEV', 'true').replace(/^export /gm, '')
stripped += '\nglobalThis.routeDeclarations = router.options.routes;'
const code = ts.transpileModule(stripped, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const context = {
  createWebHistory: () => undefined,
  createRouter: (options) => ({ options, beforeEach() {}, afterEach() {} }),
}
new Script(code).runInNewContext(context, { timeout: 1000 })
const routes = context.routeDeclarations.map((route) => {
  const name = route.component?.toString().match(/import\(['"]([^'"]+)/)?.[1]
  return {
    path: route.path,
    alias: route.alias,
    file: name ? resolveLocal(routerFile, name) : null,
    meta: route.meta || {},
    redirect: route.redirect?.toString() || '',
    dev: route.path === '/local-preview',
  }
})
const matcher = createRouter({
  history: createMemoryHistory(),
  routes: routes.map((r) => ({
    path: r.path,
    ...(r.alias ? { alias: r.alias } : {}),
    component: {},
  })),
})
const resolvePath = (path) => {
  try {
    const matched = matcher.resolve(path.replaceAll(':value', 'example'))
    const route = routes.find(
      (r) => r.path === (matched.matched.at(-1)?.aliasOf || matched.matched.at(-1))?.path,
    )
    return route?.path !== '/:pathMatch(.*)*' ? route : undefined
  } catch {
    return undefined
  }
}
const descendants = (file, mode = 'used', seen = new Set()) => {
  if (seen.has(file)) return seen
  seen.add(file)
  for (const target of records.get(file)?.[mode] || []) descendants(target, mode, seen)
  return seen
}
const routeRoots = unique(routes.map((r) => r.file).filter(Boolean))
const shells = [resolve(source, 'App.vue'), resolve(source, 'features/navigation/DashboardNav.vue')]
const screenFiles = new Set([
  ...routeRoots,
  ...Object.keys(metadata)
    .filter((f) => metadata[f].screen)
    .map((f) => resolve(source, f)),
])
const rootRoutes = (file) => routes.filter((r) => r.file && descendants(r.file).has(file))
const reachable = descendants(resolve(source, 'main.ts'), 'imports')
for (const file of vue) {
  if (!metadata[short(file)]) issues.push(`Missing purpose/access record: ${short(file)}`)
  if (!reachable.has(file)) issues.push(`Unreachable Vue file: ${short(file)}`)
  if (
    !screenFiles.has(file) &&
    !shells.includes(file) &&
    !vue.some((p) => records.get(p).used.includes(file))
  )
    issues.push(`Imported but never rendered: ${short(file)}`)
}
for (const name of Object.keys(metadata))
  if (!existsSync(resolve(source, name))) issues.push(`Stale metadata: ${name}`)

// Infer local URL shapes from source literals. Variable-only flows are documented separately.
const literalPaths = (expression) => {
  const ast = ts.createSourceFile('expression.ts', expression, ts.ScriptTarget.Latest, true)
  const values = []
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) values.push(node.text)
    else if (ts.isTemplateExpression(node))
      values.push(
        node.head.text + node.templateSpans.map((span) => ':value' + span.literal.text).join(''),
      )
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return unique(
    values
      .filter(
        (v) =>
          (v !== '/' || /^['"]\/['"]$/.test(expression.trim())) &&
          /^\/(?!\/)/.test(v) &&
          !/^\/(v1|api|brand|exercise-media)\b/.test(v),
      )
      .map((v) => v.split(/[?#]/)[0])
      .filter(Boolean),
  )
}
const candidates = []
for (const [file, record] of records) {
  if (!file.endsWith('.vue')) continue
  for (const usage of record.usages) {
    const paths = literalPaths(usage.expression)
    candidates.push({
      file,
      ...usage,
      paths,
      targets: unique(
        paths
          .map((p) => resolvePath(p.length > 1 && p.endsWith('/') ? p + ':value' : p)?.path)
          .filter(Boolean),
      ),
      dynamic: !paths.length,
    })
  }
}
const overrides = JSON.parse(
  readFileSync(new URL('./frontend-navigation.json', import.meta.url), 'utf8'),
)
for (const item of overrides.links) {
  const file = resolve(source, item.file)
  if (!existsSync(file)) issues.push(`Stale navigation review: ${item.file}`)
  for (const path of item.to)
    if (!routes.some((r) => r.path === path))
      issues.push(`Unknown reviewed target: ${item.file} → ${path}`)
  candidates.push({
    file,
    kind: 'reviewed dynamic link',
    line: 1,
    expression: item.reason,
    paths: [],
    targets: item.to,
    dynamic: false,
  })
}
const edgesFor = (file) => candidates.filter((c) => descendants(file).has(c.file))
const routeTargets = (file) => unique(edgesFor(file).flatMap((c) => c.targets))
const targetsOf = (r) => overrides.routeTargets?.[r.path] || (r.file ? routeTargets(r.file) : [])
for (const item of candidates.filter((c) =>
  ['RouterLink', 'router.push', 'router.replace', 'window.open'].includes(c.kind),
)) {
  for (const path of item.paths) {
    if (path === '/new' && item.expression.includes('listPath')) continue
    if (!resolvePath(path) && !path.endsWith('/') && !overrides.nonRoutes.includes(path))
      issues.push(`Unmatched link literal: ${short(item.file)}:${item.line} → ${path}`)
  }
}
for (const file of shells) {
  for (const path of literalPaths(records.get(file).script))
    if (!resolvePath(path) && !path.endsWith('/') && !overrides.nonRoutes.includes(path))
      issues.push(`Unmatched shell navigation: ${short(file)} → ${path}`)
}
const fmtPaths = (paths) =>
  unique(paths)
    .map((v) => `\`${v}\``)
    .join(', ') || 'None; see entry/dynamic rules.'
for (const r of routes.filter((r) => r.file && !overrides.entries[r.path] && !r.dev)) {
  if (!candidates.some((c) => c.targets.includes(r.path)))
    issues.push(`No known entry for route: ${r.path}`)
}
const header = (title) =>
  `# ${title}\n\nGenerated from maintained source and reviewed descriptions by \`npm run frontend:inventory\`. Do not edit this generated file; update the two inventory JSON files beside the script. Source audit, not rendered or security acceptance. See [scope and findings](README.md).\n\n`
const outputs = new Map()
let viewsDoc = header('Frontend views and access')
for (const file of [...screenFiles].sort()) {
  const m = metadata[short(file)] || { purpose: 'MISSING', access: 'MISSING' }
  const ownRoutes = rootRoutes(file).map((r) => r.path)
  const incoming = routes
    .filter((r) => r.file && r.file !== file && targetsOf(r).some((p) => ownRoutes.includes(p)))
    .map((r) => r.path)
  const parents = vue.filter((p) => records.get(p).used.includes(file)).map(short)
  const outgoing = routeTargets(file)
  viewsDoc += `## ${file.split(/[\\/]/).at(-1).replace('.vue', '')}\n\n- **Source:** ${link(file)}\n- **Folder:** \`${posix(relative(source, dirname(file)))}\`\n- **URL(s):** ${fmtPaths(ownRoutes)}${routeRoots.includes(file) ? '' : ' Embedded screen; no independent route.'}\n- **Purpose:** ${m.purpose}\n- **Access:** ${m.access}\n- **Opens:** ${fmtPaths(outgoing)}\n- **Opened from views:** ${fmtPaths(incoming)}\n- **Embedded by:** ${parents.length ? parents.map((p) => `\`${p}\``).join(', ') : 'Router.'}\n- **Shell entry:** ${
    shells
      .filter((s) => routeTargets(s).some((p) => ownRoutes.includes(p)))
      .map(link)
      .join(', ') || 'No direct shell item; use the workflow or entry described above.'
  }\n${m.entry ? `- **Other entry:** ${m.entry}\n` : ''}\n`
}
outputs.set('views.md', viewsDoc)
let componentDoc = header('Frontend component catalog')
componentDoc +=
  'Every local Vue file is listed, including routed screens. Direct rendered consumers come from template tags and dynamic component bindings. Views using a component include transitive consumers. Shell components are inherited by every route; role/state conditions still apply. Third-party primitives are summarized in the audit scope rather than copied into this catalog.\n\n'
for (const file of vue) {
  const m = metadata[short(file)] || { purpose: 'MISSING' }
  const parents = vue.filter((p) => records.get(p).used.includes(file))
  const use = rootRoutes(file).map((r) => r.path)
  componentDoc += `## ${file.split(/[\\/]/).at(-1).replace('.vue', '')}\n\n- **Source:** ${link(file)}\n- **Kind:** ${screenFiles.has(file) ? 'Screen or route dispatcher' : file === shells[0] ? 'Application shell' : 'Reusable/domain component'}.\n- **Purpose:** ${m.purpose}\n- **Direct rendered consumers:** ${parents.map(link).join(', ') || (routeRoots.includes(file) ? 'Router.' : file === shells[0] ? '`main.ts` mounts the shell.' : 'None.')}\n- **Views using it:** ${shells.some((s) => descendants(s).has(file)) ? 'Application shell; available on every route, conditional on shell state.' : fmtPaths(use)}\n\n`
}
outputs.set('components.md', componentDoc)
let navDoc = header('Frontend routes and navigation map')
navDoc +=
  '## Route registry\n\nThe router declaration is evaluated with inert factories to expand mapped sections and development-only routes. No guards or lifecycle callbacks are executed. `private` is sign-in gating; `institution` refreshes current membership; `adminOnly` is an additional router gate. Other role/resource restrictions belong to the view and server, not to these flags.\n\n| Path | Screen / redirect | Router gates | Entry classification |\n| --- | --- | --- | --- |\n'
for (const r of routes)
  navDoc += `| \`${r.path}\`${r.alias ? ` (alias \`${r.alias}\`)` : ''} | ${r.file ? link(r.file) : `Redirect: ${text(r.redirect)}`} | ${
    Object.keys(r.meta)
      .filter((k) => r.meta[k] === true)
      .join(', ') || 'Public'
  } | ${text(overrides.entries[r.path] || (r.dev ? 'Development only; local-preview backend must also be enabled.' : r.redirect ? 'Compatibility redirect.' : 'In-app navigation.'))} |\n`
navDoc +=
  '\n## Complete route adjacency\n\nEach row includes links in embedded components; shell navigation is listed separately to keep workflow edges readable. An inferred source-path edge means the source contains that destination; it does not prove the control is visible to every role. Query-only navigation stays on the same view. Conditional values and server-generated targets were reviewed and are recorded in the dynamic section.\n\n| From | Opens | Incoming views |\n| --- | --- | --- |\n'
for (const r of routes.filter((r) => r.file))
  navDoc += `| \`${r.path}\` | ${fmtPaths(targetsOf(r))} | ${fmtPaths(routes.filter((v) => v.file && v.path !== r.path && targetsOf(v).includes(r.path)).map((v) => v.path))} |\n`
navDoc += '\n## Shell navigation\n\n| Component | Destinations |\n| --- | --- |\n'
for (const file of shells) navDoc += `| ${link(file)} | ${fmtPaths(routeTargets(file))} |\n`
navDoc +=
  '\n## Workflow maps\n\nAll registered screen routes are nodes below. Redirects and token/dev/error entries are classified separately in the registry; they need not appear in a sidebar. These are source-derived navigation maps, not a temporal requirement to visit each page.\n'
const groups = [
  ['Entry and utilities', (r) => !r.meta.institution && !r.meta.legacyInstitution],
  ['Institution workflows', (r) => r.meta.institution || r.meta.legacyInstitution],
]
for (const [name, include] of groups) {
  const subset = routes.filter((r) => r.file && include(r))
  navDoc += `\n### ${name}\n\n\`\`\`mermaid\nflowchart LR\n`
  const ids = new Map(routes.map((r, i) => [r.path, 'r' + i]))
  const nodes = new Set(subset.map((r) => r.path))
  for (const r of subset) for (const target of targetsOf(r)) nodes.add(target)
  for (const path of nodes) navDoc += `  ${ids.get(path)}["${path.replaceAll('"', '')}"]\n`
  for (const r of subset)
    for (const target of targetsOf(r))
      if (target !== r.path) navDoc += `  ${ids.get(r.path)} --> ${ids.get(target)}\n`
  navDoc += '\`\`\`\n'
}
navDoc += '\n## Reviewed dynamic and external entries\n\n'
for (const item of overrides.links)
  navDoc += `- ${link(resolve(source, item.file))}: ${item.reason} Targets: ${fmtPaths(item.to)}.\n`
navDoc +=
  '\n## Source link evidence\n\nThese expressions are recorded rather than guessed when variable-only. A reviewed dynamic entry can account for several expressions. External URLs, byte URLs, hash anchors and API calls are not application routes.\n\n| Source | Kind | Expression | Matched route shapes |\n| --- | --- | --- | --- |\n'
for (const c of candidates.filter((c) => c.kind !== 'computed/source path'))
  navDoc += `| ${sourceLink(c.file, c.line)} | ${c.kind} | \`${text(c.expression).replaceAll('`', "'")}\` | ${fmtPaths(c.targets)} |\n`
outputs.set('navigation.md', navDoc)
mkdirSync(output, { recursive: true })
const checking = process.argv.includes('--check')
for (const [name, rawContent] of outputs) {
  const file = resolve(output, name)
  const content = await format(rawContent, { ...(await resolveConfig(file)), filepath: file })
  if (checking) {
    if (!existsSync(file) || readFileSync(file, 'utf8').replaceAll('\r\n', '\n') !== content)
      issues.push(`Stale generated inventory: ${name}; run npm run frontend:inventory`)
  } else writeFileSync(file, content)
}
console.log(
  `${vue.length} Vue files; ${screenFiles.size} screen files; ${routes.length} route records; ${candidates.length} navigation references.`,
)
if (issues.length) {
  console.error(unique(issues).join('\n'))
  process.exitCode = 1
} else
  console.log(
    'Inventory coverage, local imports, rendered component use and known navigation targets passed.',
  )
