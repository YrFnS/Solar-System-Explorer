import { spawn } from 'node:child_process'

const maximumAttempts = Math.max(
  1,
  Number.parseInt(process.env.UI_SMOKE_MAX_ATTEMPTS ?? '2', 10) || 2
)

function runAttempt(attempt) {
  return new Promise((resolve) => {
    const child = spawn('node', ['scripts/smoke-ui.mjs'], {
      env: process.env,
      stdio: 'inherit',
    })

    child.once('error', (error) => {
      console.error(`[ui-smoke-runner] attempt ${attempt} could not start`, error)
      resolve(1)
    })
    child.once('exit', (code, signal) => {
      if (signal) {
        console.error(`[ui-smoke-runner] attempt ${attempt} ended via ${signal}`)
        resolve(1)
        return
      }
      resolve(code ?? 1)
    })
  })
}

for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
  const exitCode = await runAttempt(attempt)
  if (exitCode === 0) {
    if (attempt > 1) {
      console.log(`[ui-smoke-runner] passed on attempt ${attempt}/${maximumAttempts}`)
    }
    process.exit(0)
  }

  if (attempt < maximumAttempts) {
    console.warn(
      `[ui-smoke-runner] attempt ${attempt}/${maximumAttempts} failed; retrying the isolated production browser gate once.`
    )
  } else {
    console.error(`[ui-smoke-runner] failed after ${maximumAttempts} attempt(s)`)
    process.exit(exitCode)
  }
}
