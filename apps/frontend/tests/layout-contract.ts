import { expect, type Page } from '@playwright/test'

/** Check inside clipping containers too: document overflow alone misses hidden content. */
export async function layoutIssues(page: Page) {
  return page.evaluate(() => {
    const issues: string[] = []
    if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('document overflow')
    for (const el of document.querySelectorAll<HTMLElement>('main *, .product-nav')) {
      const s = getComputedStyle(el),
        r = el.getBoundingClientRect()
      if (!r.width || !r.height || s.visibility === 'hidden' || el.closest('svg, .sr-only'))
        continue
      // A deliberate single-line text excerpt is not a clipped form/container.
      if (s.textOverflow === 'ellipsis' || el.tagName === 'OPTION') continue
      if (
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) &&
        el.scrollWidth > el.clientWidth + 2 &&
        ['hidden', 'clip'].includes(s.overflowX)
      )
        issues.push(`clipped content: ${el.tagName}.${el.className}`)
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName)) {
        for (
          let parent = el.parentElement;
          parent && parent !== document.body;
          parent = parent.parentElement
        ) {
          const p = getComputedStyle(parent),
            b = parent.getBoundingClientRect()
          if (
            ['hidden', 'clip'].includes(p.overflowX) &&
            (r.left < b.left - 2 || r.right > b.right + 2)
          ) {
            issues.push(`clipped control: ${el.tagName} in .${parent.className}`)
            break
          }
        }
      }
    }
    const layout = document.querySelector('.conversation-layout')?.getBoundingClientRect()
    const footer = document.querySelector('.footer')?.getBoundingClientRect()
    if (layout && footer && layout.bottom > footer.top + 2)
      issues.push('conversation overlaps footer')
    return [...new Set(issues)]
  })
}

/** Checks that the conversation list is populated and fits without overlapping the footer. */
export async function expectUsableInbox(page: Page) {
  await expect.poll(() => page.locator('.conversation-person').count()).toBeGreaterThan(1)
  expect(await layoutIssues(page)).toEqual([])
  const metrics = await page.locator('.conversation-person').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect(),
        box = el.closest('.conversation-inbox')!.getBoundingClientRect()
      return { height: r.height, contained: r.left >= box.left && r.right <= box.right }
    }),
  )
  expect(metrics.length).toBeGreaterThan(1)
  for (const row of metrics) {
    expect(row.contained).toBe(true)
    expect(row.height).toBeLessThan(120)
    expect(row.height).toBeGreaterThanOrEqual(44)
  }
}
