#!/usr/bin/env node
import { createRequire } from 'node:module'
import { readdirSync, rmSync, mkdtempSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { extractAll } from '@electron/asar'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(__dirname, '../dist')

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  const results = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walk(fullPath))
      continue
    }
    if (entry.isFile() && entry.name === 'app.asar') {
      results.push(fullPath)
    }
  }
  return results
}

const asarFiles = walk(distDir)
if (asarFiles.length === 0) {
  console.error('[verify:packaged] No app.asar files found under dist/.')
  process.exit(1)
}

const requiredModules = ['express', 'qs', 'side-channel', 'ee-first']

for (const asarFile of asarFiles) {
  const extractDir = mkdtempSync(join(tmpdir(), 'openstaff-asar-'))
  try {
    extractAll(asarFile, extractDir)

    const appRequire = createRequire(join(extractDir, 'package.json'))
    for (const moduleName of requiredModules) {
      appRequire(moduleName)
    }
    console.log(`[verify:packaged] ok: ${asarFile}`)
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    console.error(`[verify:packaged] failed: ${asarFile}`)
    console.error(details)
    process.exitCode = 1
  } finally {
    rmSync(extractDir, { recursive: true, force: true })
  }
}

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log('[verify:packaged] All packaged app bundles passed runtime dependency checks.')
