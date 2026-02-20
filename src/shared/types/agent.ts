export interface AgentInfo {
  id: string
  name: string
  installed: boolean
  version: string | null
  connected: boolean
  api_key_configured: boolean
  models: AgentModel[]
  status: AgentStatus
}

export type AgentStatus =
  | 'connected'
  | 'disconnected'
  | 'not_installed'
  | 'installing'
  | 'updating'

export interface AgentModel {
  id: string
  name: string
  description: string
}

export interface AgentUsage {
  today: {
    tokens: number
    cost: number
    trend: number | null
  }
  month: {
    tokens: number
    cost: number
    trend: number | null
  }
}

export interface AgentBudget {
  monthly_limit: number | null
  warning_threshold: number
}

export interface AgentUsageBreakdown {
  staff_id: string
  staff_name: string
  cost_month: number
  share_percent: number
}

export interface SpawnOptions {
  workingDir: string
  claudeMdPath: string
  env: Record<string, string>
  sessionId?: string
  model?: string
}

export interface AgentProcess {
  pid: number
  sessionId: string | null
  write(message: string): void
  onData(cb: (data: string) => void): void
  onExit(cb: (code: number) => void): void
  kill(): Promise<void>
  dispose(): void
}

export interface AgentDriver {
  id: string
  name: string
  isInstalled(): Promise<boolean>
  install(onProgress?: (percent: number) => void): Promise<void>
  getVersion(): Promise<string | null>
  getBinaryPath(): string
  getAvailableModels(): AgentModel[]
  spawn(opts: SpawnOptions): AgentProcess
  resume(opts: SpawnOptions): AgentProcess
  testConnection(apiKey: string): Promise<boolean>
}
