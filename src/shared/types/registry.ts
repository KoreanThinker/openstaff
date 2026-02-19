export interface RegistryIndex {
  version: string
  updated_at: string
  templates: RegistryTemplate[]
  skills: RegistrySkill[]
}

export interface RegistryTemplate {
  id: string
  name: string
  role: string
  category: string
  gather: string
  execute: string
  evaluate: string
  kpi: string
  required_skills: string[]
  recommended_agent: string
  recommended_model: string
}

export interface RegistrySkill {
  name: string
  description: string
  category: string
  author: string
  version: string
  auth_required: boolean
  required_env_vars: string[]
  github_path: string
}
