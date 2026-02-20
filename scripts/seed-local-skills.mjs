#!/usr/bin/env node

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const root = process.cwd()
const openstaffHome = process.env.OPENSTAFF_HOME || join(homedir(), '.openstaff')
const localSkillsDir = join(openstaffHome, 'skills')
const registryIndexPath = join(root, 'registry', 'index.json')
const registrySkillsDir = join(root, 'registry', 'skills')

const index = JSON.parse(readFileSync(registryIndexPath, 'utf-8'))
mkdirSync(localSkillsDir, { recursive: true })

let installed = 0
let skipped = 0

for (const skill of index.skills) {
  const sourceMd = join(registrySkillsDir, skill.name, 'SKILL.md')
  if (!existsSync(sourceMd)) {
    skipped += 1
    continue
  }

  const targetDir = join(localSkillsDir, skill.name)
  const targetMd = join(targetDir, 'SKILL.md')
  if (existsSync(targetMd)) {
    skipped += 1
    continue
  }

  mkdirSync(targetDir, { recursive: true })
  writeFileSync(targetMd, readFileSync(sourceMd, 'utf-8'))
  installed += 1
}

console.log(`Installed new local skills: ${installed}`)
console.log(`Skipped (already exists or missing source): ${skipped}`)
console.log(`Local skills dir: ${localSkillsDir}`)
