// accessibility audit: MEASURED with axe-core, not just "we think it's fine"
//
// run against your local build:
//   npm run build && npm run preview      (in one terminal)
//   npm run audit:ui                      (in another)
// or against the real site, signed in as a family (checks the family pages too):
//   npm run audit:ui -- https://your-site.vercel.app you@email.com password
//
// first time only: npx playwright install chromium

import { chromium } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'

const base = (process.argv[2] || 'http://localhost:4173').replace(/\/$/, '')
const [email, password] = process.argv.slice(3)

const browser = await chromium.launch({
  // a fake camera, so the recorder pages work without a real one
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
})
const context = await browser.newContext({ permissions: ['camera', 'microphone'] })
const page = await context.newPage()

let serious = 0
async function audit(name) {
  await page.waitForTimeout(1500) // let data load
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const bad = results.violations
  if (bad.length === 0) {
    console.log('PASS  ' + name)
    return
  }
  console.log('FAIL  ' + name)
  for (const v of bad) {
    if (v.impact === 'serious' || v.impact === 'critical') serious++
    console.log('      [' + v.impact + '] ' + v.id + ': ' + v.help + ' (' + v.nodes.length + 'x)')
    console.log('        ' + v.nodes[0].target.join(' '))
  }
}

async function visit(path, name) {
  await page.goto(base + path)
  await audit(name)
}

// public pages
await visit('/', 'Landing page')
await visit('/signin', 'Sign in')
await visit('/debug', 'Status page')
await page.goto(base + '/demo')
if (await page.waitForURL('**/c/**', { timeout: 15000 }).then(() => true).catch(() => false)) {
  await audit('Stranger view (demo)')
} else {
  console.log('SKIP  Stranger view (demo isn\'t set up)')
}

// family pages, if we were given an account
if (email && password) {
  await context.clearCookies()
  await page.goto(base + '/signin')
  await page.evaluate(() => localStorage.clear())
  await page.goto(base + '/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/people', { timeout: 15000 })
  await audit('Your people')

  const first = page.locator('main a[href^="/people/"]').first()
  if (await first.count()) {
    const href = await first.getAttribute('href')
    await visit(href, 'Person page')
    await visit(href + '/codes', 'Share codes')
    await visit(href + '/log', 'Who looked')
    await visit(href + '/record', 'Record a signal')
  }
  await visit('/inbox', 'Inbox')
}

await browser.close()
console.log(serious === 0 ? '\nNo serious problems.' : '\n' + serious + ' serious problems.')
process.exit(serious === 0 ? 0 : 1)
