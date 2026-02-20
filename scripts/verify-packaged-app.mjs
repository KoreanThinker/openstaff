#!/usr/bin/env node
import { createRequire } from 'node:module'
import { readdirSync, rmSync, mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { extractAll } from '@electron/asar'
import { builtinModules } from 'node:module'

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

const builtin = new Set([...builtinModules, ...builtinModules.map((id) => `node:${id}`), 'electron'])

function packageName(specifier) {
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/')
    return scope && name ? `${scope}/${name}` : specifier
  }
  const [name] = specifier.split('/')
  return name
}

function collectExternalImports(code) {
  const specs = new Set()
  const patterns = [
    /\brequire\((['"`])([^'"`]+)\1\)/g,
    /\bimport\((['"`])([^'"`]+)\1\)/g,
    /\bfrom\s+(['"`])([^'"`]+)\1/g
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(code)) !== null) {
      const spec = match[2]
      if (!spec || spec.startsWith('.') || spec.startsWith('/') || builtin.has(spec)) {
        continue
      }
      specs.add(spec)
    }
  }

  return [...specs]
}

for (const asarFile of asarFiles) {
  const extractDir = mkdtempSync(join(tmpdir(), 'openstaff-asar-'))
  try {
    extractAll(asarFile, extractDir)

    const appRequire = createRequire(join(extractDir, 'package.json'))
    const pkgJson = JSON.parse(readFileSync(join(extractDir, 'package.json'), 'utf8'))
    const rootDeps = new Set(Object.keys(pkgJson.dependencies || {}))
    const entries = [join(extractDir, 'out/main/index.js'), join(extractDir, 'out/preload/index.mjs')]
    const missing = []

    for (const entry of entries) {
      if (!existsSync(entry)) {
        continue
      }

      const code = readFileSync(entry, 'utf8')
      const imports = collectExternalImports(code)
      for (const spec of imports) {
        // Ignore accidental string matches from bundled sources unless the package
        // is declared as a runtime dependency of the app.
        if (!rootDeps.has(packageName(spec))) {
          continue
        }

        try {
          appRequire.resolve(spec)
        } catch {
          missing.push(`${spec} (from ${entry})`)
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(`Unresolved external imports:\n- ${missing.join('\n- ')}`)
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
