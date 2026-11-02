import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { chromium } from 'playwright'

const config = JSON.parse(
  await readFile(process.argv[2] ?? 'config.json', 'utf8')
)
const [session] = config.sessions
const browser = await chromium.launch({ channel: 'chrome', headless: false })
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

  const datasetTitles = Array.from({ length: 970 }, (_, index) =>
    datasetTitle(index)
  )
  const result = await page.evaluate(
    async ({ apiUrl, workspaceId, seedTitles }) => {
      for (const [index, title] of seedTitles.entries()) {
        // biome-ignore lint/performance/noAwaitInLoops: sequential writes avoid overwhelming the API
        const response = await fetch(
          `${apiUrl}/workspaces/${workspaceId}/items`,
          {
            body: JSON.stringify({
              textContent: `Synthetic RNF15 item ${index + 1}`,
              title,
              type: 'text',
            }),
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
          }
        )
        if (!response.ok) {
          return {
            created: index,
            error: `${response.status} ${await response.text()}`,
          }
        }
      }
      return { created: 970 }
    },
    {
      apiUrl: config.apiUrl,
      seedTitles: datasetTitles,
      workspaceId: config.workspaceId,
    }
  )

  if (result.created !== 970) {
    throw new Error(
      `Dataset stopped after ${result.created} records: ${result.error}`
    )
  }
  console.log(
    'Created 970 shared synthetic items; add the 30 restricted fixtures from config.json to reach 1,000. Run once in a clean workspace.'
  )
} finally {
  await context.close()
  await browser.close()
}

function datasetTitle(index) {
  if (index < 60) {
    const user = Math.floor(index / 10) + 1
    const term = (index % 10) + 1
    return `rn15single${user}term${term}`
  }
  if (index < 90) {
    const user = Math.floor((index - 60) / 5) + 1
    const term = ((index - 60) % 5) + 1
    return `rn15 phrase ${user} ${term}`
  }
  return `rn15 dataset record ${String(index - 89).padStart(4, '0')}`
}
