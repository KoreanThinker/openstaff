#!/usr/bin/env node

import { spawn } from 'node:child_process'

const mode = process.argv[2] ?? 'headless'
const extraArgs = process.argv[3] === '--' ? process.argv.slice(4) : process.argv.slice(3)

if (!['headless', 'headed', 'ui'].includes(mode)) {
  console.error(`Unknown mode "${mode}". Use one of: headless, headed, ui`)
  process.exit(1)
}

if (mode !== 'headless' && process.env.OPENSTAFF_ALLOW_HEADED !== '1') {
  console.error(
    `Blocked ${mode} run. To allow visible E2E mode, re-run with OPENSTAFF_ALLOW_HEADED=1.`
  )
  process.exit(1)
}

const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const showWindow = mode === 'headless' ? '0' : '1'
const skipBuild = process.env.OPENSTAFF_E2E_SKIP_BUILD === '1'

const sharedEnv = {
  ...process.env,
  OPENSTAFF_E2E_SHOW_WINDOW: showWindow
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env
    })

    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) return resolve()
      reject(new Error(`${command} ${args.join(' ')} failed (code=${code ?? 'null'}, signal=${signal ?? 'null'})`))
    })
  })
}

const playwrightArgs =
  mode === 'ui'
    ? ['exec', 'playwright', 'test', '--ui', ...extraArgs]
    : mode === 'headed'
      ? ['exec', 'playwright', 'test', '--headed', ...extraArgs]
      : ['exec', 'playwright', 'test', ...extraArgs]

try {
  if (!skipBuild) {
    await run(pnpmCmd, ['build'], sharedEnv)
  } else {
    console.log('OPENSTAFF_E2E_SKIP_BUILD=1 set, skipping build step.')
  }
  await run(pnpmCmd, playwrightArgs, sharedEnv)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
