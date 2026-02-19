export interface SkillInfo {
  name: string
  description: string
  author: string
  version: string
  allowed_tools: string
  compatibility: string
  auth_status: SkillAuthStatus
  required_env_vars: string[]
  connected_staffs: string[]
  source: 'local' | 'registry'
  installed_at: string
}

export type SkillAuthStatus = 'active' | 'needs_auth' | 'not_configured'

export interface SkillMdFrontmatter {
  name: string
  description: string
  'allowed-tools'?: string
  compatibility?: string
  metadata?: {
    author?: string
    version?: string
  }
}
