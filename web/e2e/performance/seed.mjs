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
      const existingTitles = new Set()
      let totalPages = 1
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
        // biome-ignore lint/performance/noAwaitInLoops: Each page reveals the total page count needed to fetch the next one.
        const response = await fetch(
          `${apiUrl}/workspaces/${workspaceId}/items?page=${pageIndex}&size=100`,
          { credentials: 'include' }
        )
        if (!response.ok) {
          return {
            created: 0,
            error: `Could not read existing items: ${response.status} ${await response.text()}`,
            skipped: 0,
          }
        }
        const { items, totalPages: pageCount } = await response.json()
        totalPages = pageCount
        for (const { title } of items) existingTitles.add(title)
      }

      let created = 0
      let skipped = 0
      for (const [index, title] of seedTitles.entries()) {
        if (existingTitles.has(title)) {
          skipped += 1
          continue
        }
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
            created,
            error: `${response.status} ${await response.text()}`,
            skipped,
          }
        }
        created += 1
        existingTitles.add(title)
      }
      return { created, skipped }
    },
    {
      apiUrl: config.apiUrl,
      seedTitles: datasetTitles,
      workspaceId: config.workspaceId,
    }
  )

  if (result.error) {
    throw new Error(
      `Dataset seeding failed after creating ${result.created} items and skipping ${result.skipped}: ${result.error}`
    )
  }
  console.log(
    `Seeded ${result.created} shared synthetic items and skipped ${result.skipped} existing ones. Add the 30 restricted fixtures from config.json to reach 1,000.`
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
