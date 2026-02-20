#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const registryDir = join(root, 'registry')
const indexPath = join(registryDir, 'index.json')
const skillsRoot = join(registryDir, 'skills')

const base = JSON.parse(readFileSync(indexPath, 'utf-8'))

const domains = [
  { id: 'github', label: 'GitHub', category: 'Dev', envVar: 'GITHUB_TOKEN' },
  { id: 'gitlab', label: 'GitLab', category: 'Dev', envVar: 'GITLAB_TOKEN' },
  { id: 'jira', label: 'Jira', category: 'PM', envVar: 'JIRA_API_TOKEN' },
  { id: 'linear', label: 'Linear', category: 'PM', envVar: 'LINEAR_API_KEY' },
  { id: 'notion', label: 'Notion', category: 'Productivity', envVar: 'NOTION_API_KEY' },
  { id: 'slack', label: 'Slack', category: 'Communication', envVar: 'SLACK_BOT_TOKEN' },
  { id: 'discord', label: 'Discord', category: 'Communication', envVar: 'DISCORD_BOT_TOKEN' },
  { id: 'telegram', label: 'Telegram', category: 'Communication', envVar: 'TELEGRAM_BOT_TOKEN' },
  { id: 'reddit', label: 'Reddit', category: 'Social', envVar: 'REDDIT_API_KEY' },
  { id: 'x', label: 'X', category: 'Social', envVar: 'X_API_KEY' },
  { id: 'linkedin', label: 'LinkedIn', category: 'Social', envVar: 'LINKEDIN_API_KEY' },
  { id: 'shopify', label: 'Shopify', category: 'Ecommerce', envVar: 'SHOPIFY_API_KEY' },
  { id: 'stripe', label: 'Stripe', category: 'Finance', envVar: 'STRIPE_API_KEY' },
  { id: 'hubspot', label: 'HubSpot', category: 'Sales', envVar: 'HUBSPOT_API_KEY' },
  { id: 'salesforce', label: 'Salesforce', category: 'Sales', envVar: 'SALESFORCE_API_KEY' },
  { id: 'zendesk', label: 'Zendesk', category: 'Support', envVar: 'ZENDESK_API_KEY' }
]

const workflows = [
  { id: 'issue-triage', label: 'Issue Triage', summary: 'Classify incoming items by urgency and owner.' },
  { id: 'weekly-report', label: 'Weekly Report', summary: 'Aggregate metrics and produce a concise weekly summary.' },
  { id: 'ops-monitor', label: 'Ops Monitor', summary: 'Watch key signals and raise alerts when thresholds are exceeded.' },
  { id: 'quality-audit', label: 'Quality Audit', summary: 'Audit quality and policy compliance with actionable findings.' },
  { id: 'workflow-automation', label: 'Workflow Automation', summary: 'Automate repetitive team workflows with deterministic steps.' },
  { id: 'customer-feedback', label: 'Customer Feedback', summary: 'Collect and summarize customer feedback into themes and actions.' },
  { id: 'campaign-optimizer', label: 'Campaign Optimizer', summary: 'Optimize campaign targeting, cadence, and copy based on outcomes.' },
  { id: 'knowledge-sync', label: 'Knowledge Sync', summary: 'Sync docs and operational notes into a single source of truth.' }
]

const manualSkills = [
  {
    name: 'instagram',
    description: 'Instagram integration for feed analysis, trend discovery, and posting workflows.',
    category: 'Social',
    author: 'openstaff',
    version: '1.0.0',
    auth_required: true,
    required_env_vars: ['INSTAGRAM_ACCESS_TOKEN'],
    github_path: 'registry/skills/instagram'
  },
  {
    name: 'meta-ads-api',
    description: 'Meta Ads API integration for campaign data ingestion and optimization loops.',
    category: 'Marketing',
    author: 'openstaff',
    version: '1.0.0',
    auth_required: true,
    required_env_vars: ['META_ADS_API_KEY'],
    github_path: 'registry/skills/meta-ads-api'
  },
  {
    name: 'google-search-console',
    description: 'Google Search Console integration for SEO monitoring and keyword reporting.',
    category: 'SEO',
    author: 'openstaff',
    version: '1.0.0',
    auth_required: true,
    required_env_vars: ['GOOGLE_SEARCH_CONSOLE_API_KEY'],
    github_path: 'registry/skills/google-search-console'
  }
]

function generateSkill(domain, workflow) {
  const name = `${domain.id}-${workflow.id}`
  return {
    name,
    description: `${domain.label} ${workflow.label.toLowerCase()} skill for autonomous execution cycles.`,
    category: domain.category,
    author: 'openstaff',
    version: '1.0.0',
    auth_required: true,
    required_env_vars: [domain.envVar],
    github_path: `registry/skills/${name}`
  }
}

function toTitle(slug) {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function skillMarkdown(skill, purpose) {
  const envLine = skill.auth_required
    ? `Requires ${skill.required_env_vars.join(', ')}.`
    : 'Works without additional credentials.'

  return `---
name: ${skill.name}
description: ${skill.description}
allowed-tools: Read Write Bash
compatibility: ${envLine}
metadata:
  author: ${skill.author}
  version: ${skill.version}
---

# ${toTitle(skill.name)}

Use this skill to run reliable ${purpose} cycles inside OpenStaff.

## Execution guide

1. Gather the latest context and constraints from source systems.
2. Execute one bounded batch of work and log outcomes.
3. Evaluate quality and KPI impact, then queue the next cycle.

## Output contract

- Write machine-readable summaries for each cycle.
- Include blockers and next actions.
- Keep changes small, verifiable, and reversible.
`
}

const generated = []
for (const domain of domains) {
  for (const workflow of workflows) {
    generated.push(generateSkill(domain, workflow))
  }
}

const allSkills = [...base.skills, ...manualSkills, ...generated]
const dedupedMap = new Map()
for (const skill of allSkills) {
  dedupedMap.set(skill.name, skill)
}
const deduped = Array.from(dedupedMap.values()).sort((a, b) => a.name.localeCompare(b.name))

const nextIndex = {
  ...base,
  version: '1.1.0',
  updated_at: new Date().toISOString(),
  skills: deduped
}

writeFileSync(indexPath, `${JSON.stringify(nextIndex, null, 2)}\n`)
mkdirSync(skillsRoot, { recursive: true })

const generatedNames = new Set([...manualSkills.map((s) => s.name), ...generated.map((s) => s.name)])
for (const skill of deduped) {
  if (!generatedNames.has(skill.name)) continue
  const dir = join(skillsRoot, skill.name)
  mkdirSync(dir, { recursive: true })
  const mdPath = join(dir, 'SKILL.md')
  const purpose = workflows.find((w) => skill.name.endsWith(w.id))?.label.toLowerCase() ?? 'operational'
  writeFileSync(mdPath, skillMarkdown(skill, purpose))
}

const total = nextIndex.skills.length
const created = Array.from(generatedNames).filter((name) => existsSync(join(skillsRoot, name, 'SKILL.md'))).length
console.log(`Registry skills total: ${total}`)
console.log(`Generated/updated SKILL.md files: ${created}`)
