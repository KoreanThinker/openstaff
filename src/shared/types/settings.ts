export interface AppSettings {
  anthropic_api_key: string
  openai_api_key: string
  slack_webhook_url: string
  ngrok_api_key: string
  ngrok_auth_password: string
  default_agent: string
  default_model: string
  setup_completed: boolean
  start_on_login: boolean
  show_window_on_startup: boolean
  auto_update_agents: boolean
  theme: 'light' | 'dark' | 'system'
  monthly_budget_usd: number
  budget_warning_percent: number
}

export type SettingsKey = keyof AppSettings

export interface SystemResources {
  cpu_percent: number
  memory_percent: number
  memory_used_mb: number
  memory_total_mb: number
}

export interface DashboardStats {
  active_staffs: number
  total_staffs: number
  error_staffs: number
  cost_today: number
  cost_today_trend: number | null
  cost_month: number
  cost_month_trend: number | null
  total_cycles: number
  cycles_trend: number | null
  tokens_today: number
  tokens_month: number
}
