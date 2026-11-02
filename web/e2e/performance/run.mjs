import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const ATTEMPTS_PER_SESSION = 20
const SEARCH_TIMEOUT_MS = 10_000
const PASS_LIMIT_MS = 2000
const TIMEOUT_PATTERN = /timeout/i
const configPath = path.resolve(process.argv[2] ?? 'config.json')
const config = JSON.parse(await readFile(configPath, 'utf8'))
const { selectors, sessions } = config
const rows = []
const evidencePaths = { csvPath: '' }

if (sessions.length !== 6) throw new Error('Exactly six sessions are required')
if (new Set(sessions.map(({ email }) => email)).size !== 6) {
  throw new Error('Each session must use a distinct account')
}
if (
  new Set(sessions.map(({ expectedIdentity }) => expectedIdentity)).size !== 6
) {
  throw new Error('Each session must use a distinct expected identity')
}
if (!config.workspaceId || config.workspaceId.startsWith('replace-')) {
  throw new Error('Set workspaceId in the local config file')
}
if (
  typeof config.deployedCodeRevision !== 'string' ||
  !config.deployedCodeRevision.trim() ||
  /replace|placeholder|unknown|todo/i.test(config.deployedCodeRevision)
) {
  throw new Error(
    'Set deployedCodeRevision to the deployed commit SHA or release version'
  )
}
const network = config.environment?.network
if (
  typeof network?.connection !== 'string' ||
  !network.connection.trim() ||
  /replace|placeholder|unknown|todo/i.test(network.connection) ||
  !Number.isFinite(network.downlinkMbps) ||
  network.downlinkMbps <= 0 ||
  !Number.isFinite(network.rttMs) ||
  network.rttMs < 0 ||
  typeof network.notes !== 'string' ||
  network.notes.trim().length < 10 ||
  /replace|placeholder|unknown|todo/i.test(network.notes)
) {
  throw new Error(
    'Record connection, positive downlinkMbps, rttMs, and meaningful network notes'
  )
}
if (config.uiAdapterVerified !== true) {
  throw new Error(
    'Verify the #134 search UI adapter and set uiAdapterVerified=true'
  )
}
if (config.aclFixturesVerified !== true) {
  throw new Error(
    'Verify all restricted-item fixtures and set aclFixturesVerified=true'
  )
}
if (config.datasetVerified !== true || config.datasetItems !== 1000) {
  throw new Error(
    'Verify the 1,000-item workspace and set datasetItems=1000 and datasetVerified=true'
  )
}
for (const [sessionIndex, session] of sessions.entries()) {
  if (!session.storageState)
    throw new Error(`Session ${sessionIndex + 1} needs a prepared storageState`)
  if (!session.expectedIdentity)
    throw new Error(`Session ${sessionIndex + 1} needs an expectedIdentity`)
  if (session.noAccessQueries?.length !== 5) {
    throw new Error(
      `Session ${sessionIndex + 1} needs five existing inaccessible-item queries`
    )
  }
}
if (!(selectors.identity && selectors.identityAttribute)) {
  throw new Error(
    'Configure selectors.identity and selectors.identityAttribute to verify each session account'
  )
}
const allQueries = sessions.flatMap((session, sessionIndex) => [
  ...Array.from(
    { length: 10 },
    (_, index) => `rn15single${sessionIndex + 1}term${index + 1}`
  ),
  ...Array.from(
    { length: 5 },
    (_, index) => `rn15 phrase ${sessionIndex + 1} ${index + 1}`
  ),
  ...session.noAccessQueries,
])
if (new Set(allQueries).size !== 120)
  throw new Error('All 120 search terms must be unique')

const browser = await chromium.launch({ channel: 'chrome', headless: false })
let prepared = []
let fatalError = ''
const startedAt = new Date().toISOString()

try {
  prepared = await Promise.all(
    sessions.map(async (session, sessionIndex) => {
      try {
        const context = await browser.newContext({
          storageState: path.resolve(
            path.dirname(configPath),
            session.storageState
          ),
        })
        const page = await context.newPage()
        await page.goto(config.appUrl)
        await page
          .locator(selectors.identity)
          .waitFor({ state: 'visible', timeout: 30_000 })
        const identity = await page
          .locator(selectors.identity)
          .getAttribute(selectors.identityAttribute)
        if (identity !== session.expectedIdentity) {
          throw new Error(
            `Session ${sessionIndex + 1} storageState identity does not match its configured account`
          )
        }
        await page
          .locator(selectors.searchInput)
          .waitFor({ state: 'visible', timeout: 30_000 })
        return { context, error: '', page, sessionIndex }
      } catch (cause) {
        return {
          context: null,
          error: errorText(cause),
          page: null,
          sessionIndex,
        }
      }
    })
  )

  await Promise.all(prepared.map(runSession))
} catch (cause) {
  fatalError = errorText(cause)
} finally {
  await Promise.allSettled(prepared.map(({ context }) => context?.close()))
  await browser.close()
  await saveEvidence()
}

if (fatalError)
  throw new Error(`Runner failed after saving evidence: ${fatalError}`)
console.log(`Recorded ${rows.length} attempts to ${evidencePaths.csvPath}`)
console.log(
  `<=2s: ${rows.filter((row) => row.within2s).length}/120; pass requires 114`
)

async function runSession({
  context,
  page: initialPage,
  sessionIndex,
  error: setupError,
}) {
  let page = initialPage
  let sessionError = setupError

  for (
    let attemptIndex = 0;
    attemptIndex < ATTEMPTS_PER_SESSION;
    attemptIndex += 1
  ) {
    const attempt = makeAttempt(
      sessions[sessionIndex],
      sessionIndex,
      attemptIndex
    )
    const row = {
      attempt: attemptIndex + 1,
      durationMs: '',
      error: sessionError,
      kind: attempt.kind,
      query: attempt.query,
      resultCount: '',
      session: sessionIndex + 1,
      startedAt: new Date().toISOString(),
      status: 'not-submitted',
      submitted: false,
      within2s: false,
    }

    if (!sessionError && page) {
      // biome-ignore lint/performance/noAwaitInLoops: attempts for one session must stay sequential
      const result = await runAttempt(page, context, attempt, row)
      ;({ page, sessionError } = result)
    }

    rows.push(row)
  }
}

async function runAttempt(page, context, attempt, row) {
  let pendingSearch
  let start
  try {
    await page.locator(selectors.searchInput).fill(attempt.query)
    start = await page.evaluate(() => performance.now())
    row.startedAt = new Date().toISOString()
    pendingSearch = submitAndWait(page, attempt, () => {
      row.submitted = true
    })
    const outcome = await withTimeout(pendingSearch, SEARCH_TIMEOUT_MS)
    const elapsedMs = outcome.completedAt - start
    row.durationMs = Math.round(elapsedMs * 100) / 100
    row.resultCount = outcome.count
    row.status = outcome.matchesExpectation
      ? elapsedMs <= PASS_LIMIT_MS
        ? 'completed'
        : 'slow'
      : 'functional-mismatch'
    row.within2s = outcome.matchesExpectation && elapsedMs <= PASS_LIMIT_MS
    return { page, sessionError: '' }
  } catch (cause) {
    if (start !== undefined) {
      const finishedAt = await page
        .evaluate(() => performance.now())
        .catch(() => undefined)
      if (finishedAt !== undefined)
        row.durationMs = Math.round((finishedAt - start) * 100) / 100
    }
    row.error = errorText(cause)
    if (!TIMEOUT_PATTERN.test(row.error)) {
      row.status = row.submitted ? 'error' : 'not-submitted'
      return { page, sessionError: '' }
    }
    const recovery = await recoverPage(page, context, pendingSearch)
    row.status = row.submitted ? 'timeout' : 'not-submitted'
    if (recovery.error) {
      row.error += `; recovery: ${recovery.error}`
      return {
        page: recovery.page,
        sessionError: `recovery: ${recovery.error}`,
      }
    }
    return { page: recovery.page, sessionError: '' }
  }
}

async function recoverPage(page, context, pendingSearch) {
  await page.close().catch(() => undefined)
  await pendingSearch?.catch(() => undefined)
  try {
    const recoveredPage = await context.newPage()
    await recoveredPage.goto(config.appUrl)
    await recoveredPage
      .locator(selectors.searchInput)
      .waitFor({ state: 'visible', timeout: 30_000 })
    return { error: '', page: recoveredPage }
  } catch (cause) {
    return { error: errorText(cause), page: null }
  }
}

async function submitAndWait(page, attempt, markSubmitted) {
  await page.locator(selectors.searchSubmit).click()
  markSubmitted()
  return waitForVisibleResults(page, attempt)
}

async function waitForVisibleResults(page, attempt) {
  const handle = await page.waitForFunction(
    ({ selectors: pageSelectors, kind: attemptKind, query: attemptQuery }) => {
      const visible = (element) => {
        if (!element?.getClientRects().length) return false
        for (
          let ancestor = element;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const style = getComputedStyle(ancestor)
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.visibility === 'collapse' ||
            style.opacity === '0' ||
            style.contentVisibility === 'hidden'
          )
            return false
        }
        return true
      }
      const results = document.querySelector(pageSelectors.visibleResults)
      if (
        !visible(results) ||
        results.getAttribute(pageSelectors.resultQueryAttribute) !==
          attemptQuery
      )
        return false
      const items = [
        ...results.querySelectorAll('[data-testid=search-result]'),
      ].filter(visible)
      const emptyResultsVisible = visible(
        document.querySelector(pageSelectors.emptyResults)
      )
      const matchesExpectation =
        attemptKind === 'no-access'
          ? items.length === 0 && emptyResultsVisible
          : items.some(
              (item) =>
                item.getAttribute(pageSelectors.resultTitleAttribute) ===
                attemptQuery
            )
      return {
        completedAt: performance.now(),
        count: items.length,
        matchesExpectation,
      }
    },
    { kind: attempt.kind, query: attempt.query, selectors },
    { timeout: SEARCH_TIMEOUT_MS }
  )
  try {
    return await handle.jsonValue()
  } finally {
    await handle.dispose()
  }
}

function makeAttempt(session, sessionIndex, attemptIndex) {
  if (attemptIndex < 10) {
    return {
      kind: 'single',
      query: `rn15single${sessionIndex + 1}term${attemptIndex + 1}`,
    }
  }
  if (attemptIndex < 15) {
    return {
      kind: 'multi',
      query: `rn15 phrase ${sessionIndex + 1} ${attemptIndex - 9}`,
    }
  }
  return {
    kind: 'no-access',
    query: session.noAccessQueries[attemptIndex - 15],
  }
}

async function withTimeout(promise, timeoutMs) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function saveEvidence() {
  const timestamp = new Date()
    .toISOString()
    .replaceAll(':', '-')
    .replaceAll('.', '-')
  const outputDir = path.resolve(path.dirname(configPath), 'results')
  const csvPath = path.join(outputDir, `rnf15-${timestamp}.csv`)
  const metadataPath = path.join(outputDir, `rnf15-${timestamp}.json`)
  await mkdir(outputDir, { recursive: true })
  const within2s = rows.filter((row) => row.within2s).length
  await writeFile(csvPath, toCsv(rows))
  await writeFile(
    metadataPath,
    `${JSON.stringify(
      {
        aclFixturesVerified: config.aclFixturesVerified,
        apiUrl: config.apiUrl,
        appUrl: config.appUrl,
        browser: browser.version(),
        cpu: os.cpus()[0]?.model ?? 'unknown',
        datasetItems: config.datasetItems,
        datasetVerified: config.datasetVerified,
        date: new Date().toISOString(),
        deployedCodeRevision: config.deployedCodeRevision,
        environment: config.environment,
        fatalError,
        memoryGiB: Math.round(os.totalmem() / 1024 ** 3),
        networkConditions: config.environment.network,
        node: process.version,
        note: 'RNF15 evidence requires the configured #134 UI adapter and ACL fixtures; this run does not create or claim either.',
        os: `${os.type()} ${os.release()} ${os.arch()}`,
        passed:
          config.datasetVerified === true &&
          rows.length === 120 &&
          rows.filter((row) => row.submitted).length === 120 &&
          within2s >= 114,
        scheduledAttempts: rows.length,
        startedAt,
        submittedAttempts: rows.filter((row) => row.submitted).length,
        uiAdapterVerified: config.uiAdapterVerified,
        within2s,
        workspaceId: config.workspaceId,
      },
      null,
      2
    )}\n`
  )
  evidencePaths.csvPath = csvPath
}

function toCsv(records) {
  const fields = [
    'session',
    'attempt',
    'kind',
    'query',
    'startedAt',
    'submitted',
    'durationMs',
    'resultCount',
    'status',
    'within2s',
    'error',
  ]
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  return `${fields.map(quote).join(',')}\n${records
    .map((record) => fields.map((field) => quote(record[field])).join(','))
    .join('\n')}\n`
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error)
}
