export interface StaffConfig {
  id: string
  name: string
  role: string
  gather: string
  execute: string
  evaluate: string
  kpi: string
  agent: string
  model: string
  skills: string[]
  created_at: string
}

export interface StaffState {
  session_id: string | null
  last_started_at: string | null
  paused?: boolean
}

export type StaffStatus = 'running' | 'stopped' | 'paused' | 'error' | 'warning'

export interface StaffSummary {
  id: string
  name: string
  role: string
  status: StaffStatus
  agent: string
  model: string
  uptime: number | null
  restarts: number
  tokens_today: number
  cost_today: number
  cycles: number
  kpi_summary: KpiSummaryEntry[]
}

export interface KpiSummaryEntry {
  name: string
  value: number
  trend: number | null
}

export interface StaffDetail extends StaffConfig {
  status: StaffStatus
  state: StaffState
  uptime: number | null
  restarts: number
  cycles: number
  latest_cycle: CycleEntry | null
  kpi_summary: KpiSummaryEntry[]
}

export interface CycleEntry {
  cycle: number
  date: string
  summary: string
}

export interface KpiEntry {
  date: string
  cycle: number
  metrics: Record<string, number>
}

export interface ErrorEntry {
  timestamp: string
  type: 'process_crash' | 'api_error' | 'health_check' | 'giveup'
  message: string
  details?: string
}

export interface SignalEntry {
  type: 'giveup'
  reason: string
  timestamp: string
}

export interface UsageEntry {
  date: string
  hour?: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  cost_usd: number
}

export interface StaffExport {
  openstaff_version: string
  type: 'staff'
  name: string
  role: string
  gather: string
  execute: string
  evaluate: string
  kpi: string
  required_skills: string[]
  recommended_agent: string
  recommended_model: string
}
