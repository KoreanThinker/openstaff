const getBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.api) {
    // In Electron, the API port is injected
    return `http://localhost:${(window as Window & { __apiPort?: number }).__apiPort || 19836}`
  }
  // In web/Ngrok mode, use current origin
  return ''
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getBaseUrl()
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((body as { error: string }).error || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  // Staffs
  getStaffs: () => request<import('@shared/types').StaffSummary[]>('/api/staffs'),
  getStaff: (id: string) => request<import('@shared/types').StaffDetail>(`/api/staffs/${id}`),
  createStaff: (data: Partial<import('@shared/types').StaffConfig>) =>
    request<import('@shared/types').StaffConfig>('/api/staffs', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateStaff: (id: string, data: Partial<import('@shared/types').StaffConfig>) =>
    request<import('@shared/types').StaffConfig>(`/api/staffs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteStaff: (id: string) => request<void>(`/api/staffs/${id}`, { method: 'DELETE' }),
  startStaff: (id: string) => request<{ status: string }>(`/api/staffs/${id}/start`, { method: 'POST' }),
  stopStaff: (id: string) => request<{ status: string }>(`/api/staffs/${id}/stop`, { method: 'POST' }),
  restartStaff: (id: string) => request<{ status: string }>(`/api/staffs/${id}/restart`, { method: 'POST' }),
  getStaffMetrics: (id: string) => request<import('@shared/types').UsageEntry[]>(`/api/staffs/${id}/metrics`),
  getStaffKpi: (id: string) => request<import('@shared/types').KpiEntry[]>(`/api/staffs/${id}/kpi`),
  getStaffMemory: (id: string) => request<{ content: string }>(`/api/staffs/${id}/memory`),
  getStaffErrors: (id: string) => request<import('@shared/types').ErrorEntry[]>(`/api/staffs/${id}/errors`),
  getStaffCycles: (id: string) => request<import('@shared/types').CycleEntry[]>(`/api/staffs/${id}/cycles`),
  getStaffLogs: (id: string) => request<{ lines: string[] }>(`/api/staffs/${id}/logs`),

  // Skills
  getSkills: () => request<import('@shared/types').SkillInfo[]>('/api/skills'),
  getSkill: (name: string) => request<import('@shared/types').SkillInfo>(`/api/skills/${name}`),
  importSkill: (path: string) => request<{ name: string }>('/api/skills/import', {
    method: 'POST',
    body: JSON.stringify({ path })
  }),
  updateSkillAuth: (name: string, envVars: Record<string, string>) =>
    request<{ status: string }>(`/api/skills/${name}/auth`, {
      method: 'PUT',
      body: JSON.stringify(envVars)
    }),
  deleteSkill: (name: string) => request<void>(`/api/skills/${name}`, { method: 'DELETE' }),

  // Agents
  getAgents: () => request<import('@shared/types').AgentInfo[]>('/api/agents'),
  getAgent: (id: string) => request<import('@shared/types').AgentInfo>(`/api/agents/${id}`),
  installAgent: (id: string) => request<{ status: string }>(`/api/agents/${id}/install`, { method: 'POST' }),
  updateAgentApiKey: (id: string, apiKey: string) =>
    request<{ status: string }>(`/api/agents/${id}/api-key`, {
      method: 'PUT',
      body: JSON.stringify({ api_key: apiKey })
    }),
  testAgentConnection: (id: string) =>
    request<{ connected: boolean }>(`/api/agents/${id}/test-connection`, { method: 'POST' }),

  // Settings
  getSettings: () => request<import('@shared/types').AppSettings>('/api/settings'),
  updateSettings: (data: Record<string, unknown>) =>
    request<{ status: string }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  // System
  getSystemResources: () => request<import('@shared/types').SystemResources>('/api/system/resources'),
  getDashboardStats: () => request<import('@shared/types').DashboardStats>('/api/system/stats'),

  // Registry
  getRegistry: () => request<import('@shared/types').RegistryIndex>('/api/registry'),
  getRegistryTemplates: () => request<import('@shared/types').RegistryTemplate[]>('/api/registry/templates'),
  getRegistrySkills: () => request<import('@shared/types').RegistrySkill[]>('/api/registry/skills')
}
