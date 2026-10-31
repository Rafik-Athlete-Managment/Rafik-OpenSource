import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../src/', import.meta.url))
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = resolve(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
describe('supported frontend view tree', () => {
  it('contains no orphaned Vue views or alternate institution-prefixed implementations', () => {
    const seen = new Set<string>(),
      pending = [resolve(source, 'main.ts')]
    while (pending.length) {
      const path = pending.pop()!
      if (seen.has(path)) continue
      seen.add(path)
      if (!/\.(vue|ts|css)$/.test(path)) continue
      const text = readFileSync(path, 'utf8')
      for (const match of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
        if (!match[1]!.startsWith('.')) continue
        const base = resolve(dirname(path), match[1]!)
        const target = [
          base,
          ...['.ts', '.vue', '.css', '.json'].map((ext) => base + ext),
          resolve(base, 'index.ts'),
        ].find((p) => existsSync(p) && statSync(p).isFile())
        if (target && !relative(source, target).startsWith('..' + sep)) pending.push(target)
      }
    }
    const views = files(source).filter((p) => p.endsWith('.vue'))
    expect(views.filter((p) => !seen.has(p)).map((p) => relative(source, p))).toEqual([])
    expect(views.filter((p) => /[/\\](Organization|Institution)[^/\\]*\.vue$/.test(p))).toEqual([])
  })
  it('registers the supported Resources and Nutrition routes', () => {
    const router = readFileSync(resolve(source, 'app/router.ts'), 'utf8')
    expect(router).toMatch(/path:\s*'\/resources'/)
    expect(router).toContain('features/resources/ResourcesPage.vue')
    expect(router).toMatch(/path:\s*'\/nutrition'/)
    expect(router).toContain('features/nutrition/NutritionRoute.vue')
  })
})
