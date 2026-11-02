import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const configPath = path.resolve(process.argv[2] ?? 'config.json')
const config = JSON.parse(await readFile(configPath, 'utf8'))
const browser = await chromium.launch({ channel: 'chrome', headless: false })

try {
  for (const [index, session] of config.sessions.entries()) {
    // biome-ignore lint/performance/noAwaitInLoops: Logins must stay sequential and spaced to respect the rate limit.
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 13_000))
    await authenticateSession(session, index)
  }
} finally {
  await browser.close()
}

console.log(
  'Prepared six isolated storage states. Login attempts were spaced to respect the rate limit.'
)

async function authenticateSession(session, index) {
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await page.goto(config.appUrl)
    await page.locator(config.selectors.email).fill(session.email)
    await page.locator(config.selectors.password).fill(session.password)
    await page.locator(config.selectors.loginSubmit).click()
    await page
      .locator(config.selectors.authenticatedApp)
      .waitFor({ state: 'visible', timeout: 30_000 })
    const storageState = session.storageState ?? `states/user-${index + 1}.json`
    const storageStatePath = path.resolve(
      path.dirname(configPath),
      storageState
    )
    await mkdir(path.dirname(storageStatePath), { recursive: true })
    await context.storageState({ path: storageStatePath })
  } finally {
    await context.close()
  }
}
