import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Sun,
  Moon,
  Monitor
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { AgentInfo, AgentModel } from '@shared/types'

const FALLBACK_CLAUDE_MODELS: AgentModel[] = [
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    description: 'Balanced'
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    description: 'Most capable'
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    description: 'Fastest'
  }
]

const FALLBACK_CODEX_MODELS: AgentModel[] = [
  {
    id: 'gpt-5',
    name: 'GPT-5',
    description: 'Most capable'
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 mini',
    description: 'Balanced speed and cost'
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 nano',
    description: 'Fastest and lowest cost'
  }
]

const FALLBACK_GEMINI_MODELS: AgentModel[] = [
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Most capable'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Balanced speed and quality'
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Fastest and lowest cost'
  }
]

const FALLBACK_AGENTS: AgentInfo[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    installed: false,
    version: null,
    connected: false,
    api_key_configured: false,
    models: FALLBACK_CLAUDE_MODELS,
    status: 'not_installed'
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    installed: false,
    version: null,
    connected: false,
    api_key_configured: false,
    models: FALLBACK_CODEX_MODELS,
    status: 'not_installed'
  },
  {
    id: 'gemini-cli',
    name: 'Google Gemini CLI',
    installed: false,
    version: null,
    connected: false,
    api_key_configured: false,
    models: FALLBACK_GEMINI_MODELS,
    status: 'not_installed'
  }
]

function fallbackModelsForAgent(agentId: string): AgentModel[] {
  if (agentId === 'claude-code') return FALLBACK_CLAUDE_MODELS
  if (agentId === 'codex') return FALLBACK_CODEX_MODELS
  if (agentId === 'gemini-cli') return FALLBACK_GEMINI_MODELS
  return FALLBACK_CLAUDE_MODELS
}

function useDebounce<T>(
  callback: (value: T) => void,
  delay: number
): (value: T) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback(
    (value: T) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => callback(value), delay)
    },
    [callback, delay]
  )
}

export function Settings(): React.ReactElement {
  const queryClient = useQueryClient()
  const setTheme = useSettingsStore((s) => s.setTheme)
  const currentTheme = useSettingsStore((s) => s.theme)

  const {
    data: settings,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings
  })

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    }
  })

  // Local state
  const [ngrokKey, setNgrokKey] = useState('')
  const [ngrokPassword, setNgrokPassword] = useState('')
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('')
  const [showNgrokKey, setShowNgrokKey] = useState(false)
  const [showNgrokPassword, setShowNgrokPassword] = useState(false)
  const [showSlackWebhookUrl, setShowSlackWebhookUrl] = useState(false)
  const [copied, setCopied] = useState(false)
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [updateResult, setUpdateResult] = useState<{ available: boolean; version?: string } | null>(null)
  const [defaultAgent, setDefaultAgent] = useState('claude-code')
  const [defaultModel, setDefaultModel] = useState('claude-sonnet-4-5')
  const [startOnLogin, setStartOnLogin] = useState(false)
  const [showOnStartup, setShowOnStartup] = useState(true)
  const agentOptions = agents && agents.length > 0 ? agents : FALLBACK_AGENTS

  // Sync from API
  useEffect(() => {
    if (settings) {
      setNgrokKey(settings.ngrok_api_key || '')
      setNgrokPassword(settings.ngrok_auth_password || '')
      setSlackWebhookUrl(settings.slack_webhook_url || '')
      setStartOnLogin(settings.start_on_login ?? false)
      setShowOnStartup(settings.show_window_on_startup ?? true)

      const fallbackAgentId =
        agentOptions.find((agent) => agent.models.length > 0)?.id ||
        agentOptions[0]?.id ||
        'claude-code'
      const configuredAgent = settings.default_agent || fallbackAgentId
      const nextAgent = agentOptions.some((agent) => agent.id === configuredAgent && agent.models.length > 0)
        ? configuredAgent
        : fallbackAgentId

      const modelsForAgent =
        agentOptions.find((agent) => agent.id === nextAgent)?.models ?? []
      const modelFallback = modelsForAgent[0]?.id || fallbackModelsForAgent(nextAgent)[0]?.id || FALLBACK_CLAUDE_MODELS[0].id
      const requestedModel = settings.default_model || modelFallback
      const hasRequestedModel = modelsForAgent.some((model) => model.id === requestedModel)
      setDefaultAgent(nextAgent)
      setDefaultModel(hasRequestedModel ? requestedModel : modelFallback)
    }
  }, [settings, agentOptions])

  const debouncedSave = useDebounce(
    useCallback(
      (data: Record<string, unknown>) => {
        updateMutation.mutate(data)
      },
      [updateMutation]
    ),
    500
  )

  const handleImmediateSave = useCallback(
    (data: Record<string, unknown>) => {
      updateMutation.mutate(data)
    },
    [updateMutation]
  )

  const handleCopyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* Clipboard access may be denied in some environments */ }
  }, [])

  const handleCheckUpdates = useCallback(async () => {
    setCheckingUpdates(true)
    setUpdateResult(null)
    try {
      const result = await window.api.checkForUpdates()
      setUpdateResult({ available: result.updateAvailable, version: result.version })
    } catch {
      setUpdateResult({ available: false })
    } finally {
      setCheckingUpdates(false)
    }
  }, [])

  // Get available models for the selected agent
  const selectedAgent = agentOptions.find((agent) => agent.id === defaultAgent) || null
  const availableModels =
    selectedAgent?.models.length
      ? selectedAgent.models
      : fallbackModelsForAgent(selectedAgent?.id || 'claude-code')

  // Query ngrok status from system API
  const { data: ngrokStatus } = useQuery({
    queryKey: ['ngrok-status'],
    queryFn: () => api.get('/api/system/ngrok') as Promise<{
      ngrok_status: string
      ngrok_url: string | null
      ngrok_error: string | null
    }>,
    refetchInterval: 10_000
  })

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="p-6 pb-4">
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        </div>
        <div className="space-y-6 px-6 pb-6">
          <Skeleton className="h-48 w-full rounded-lg" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="p-6 pb-4">
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-destructive">Could not load settings.</p>
          <Button variant="outline" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="p-6 pb-4">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
      </div>

      <div className="flex-1 space-y-6 overflow-auto px-6 pb-6">
        {/* Remote Access */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Remote Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">
                Ngrok API Key
              </Label>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showNgrokKey ? 'text' : 'password'}
                    placeholder="ngrok_xxxxxxxxxxxxxxxx"
                    value={ngrokKey}
                    onChange={(e) => {
                      setNgrokKey(e.target.value)
                      debouncedSave({ ngrok_api_key: e.target.value })
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                    onClick={() => setShowNgrokKey(!showNgrokKey)}
                    aria-label={showNgrokKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showNgrokKey ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">
                Auth Password
              </Label>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showNgrokPassword ? 'text' : 'password'}
                    placeholder="Set a password for remote access"
                    value={ngrokPassword}
                    onChange={(e) => {
                      setNgrokPassword(e.target.value)
                      debouncedSave({ ngrok_auth_password: e.target.value })
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                    onClick={() => setShowNgrokPassword(!showNgrokPassword)}
                    aria-label={showNgrokPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNgrokPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
              {!ngrokPassword && ngrokKey && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Set an auth password to enable remote access.
                </p>
              )}
              {ngrokKey && ngrokPassword && (
                <p className="mt-1 text-xs text-warning">
                  Remote access exposes your local dashboard to the internet. Use a strong password
                  and rotate both Ngrok/API credentials regularly.
                </p>
              )}
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">
                Slack Webhook URL
              </Label>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showSlackWebhookUrl ? 'text' : 'password'}
                    placeholder="https://hooks.slack.com/services/..."
                    value={slackWebhookUrl}
                    onChange={(e) => {
                      setSlackWebhookUrl(e.target.value)
                      debouncedSave({ slack_webhook_url: e.target.value })
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                    onClick={() => setShowSlackWebhookUrl(!showSlackWebhookUrl)}
                    aria-label={showSlackWebhookUrl ? 'Hide webhook URL' : 'Show webhook URL'}
                  >
                    {showSlackWebhookUrl ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional. Sends staff errors, giveup, and budget warnings to Slack.
              </p>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  ngrokStatus?.ngrok_status === 'connected'
                    ? 'bg-success animate-status-pulse'
                    : ngrokStatus?.ngrok_status === 'connecting'
                      ? 'bg-muted-foreground animate-spin'
                      : ngrokStatus?.ngrok_status === 'error'
                        ? 'bg-destructive'
                        : 'bg-muted-foreground'
                )}
              />
              <span
                className={cn(
                  'text-sm',
                  ngrokStatus?.ngrok_status === 'connected'
                    ? 'text-success'
                    : ngrokStatus?.ngrok_status === 'error'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                )}
              >
                {ngrokStatus?.ngrok_status === 'connected'
                  ? 'Connected'
                  : ngrokStatus?.ngrok_status === 'connecting'
                    ? 'Connecting...'
                    : ngrokStatus?.ngrok_status === 'error'
                      ? 'Connection failed'
                      : 'Disconnected'}
              </span>
            </div>

            {ngrokStatus?.ngrok_error && (
              <p className="text-sm text-destructive">
                {ngrokStatus.ngrok_error}
              </p>
            )}

            {ngrokStatus?.ngrok_url && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-foreground">
                  {ngrokStatus.ngrok_url}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleCopyUrl(ngrokStatus.ngrok_url!)}
                  aria-label="Copy URL"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Defaults + App Behavior side by side */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Defaults */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Defaults</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">
                  Default Agent
                </Label>
                <Select
                  value={defaultAgent}
                  onValueChange={(value) => {
                    setDefaultAgent(value)
                    const firstModel =
                      agentOptions.find((agent) => agent.id === value)?.models[0]?.id ||
                      fallbackModelsForAgent(value)[0]?.id
                    if (!firstModel) return
                    setDefaultModel(firstModel)
                    handleImmediateSave({
                      default_agent: value,
                      default_model: firstModel
                    })
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {agentOptions.map((agent) => {
                      const isUnavailable = agent.models.length === 0
                      return (
                        <SelectItem key={agent.id} value={agent.id} disabled={isUnavailable}>
                          {agent.name}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">
                  Default Model
                </Label>
                <Select
                  value={defaultModel}
                  onValueChange={(value) => {
                    setDefaultModel(value)
                    handleImmediateSave({ default_model: value })
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                Applied to new Staff only. Existing Staff keep their current
                agent and model.
              </p>
            </CardContent>
          </Card>

          {/* App Behavior */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">App Behavior</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm text-foreground">
                    Start on Login
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    OpenStaff launches automatically when you log in.
                  </p>
                </div>
                <Switch
                  checked={startOnLogin}
                  onCheckedChange={(checked) => {
                    setStartOnLogin(checked)
                    handleImmediateSave({ start_on_login: checked })
                    // Set OS login item via Electron IPC
                    window.api?.setAutoStart?.(checked).catch(() => {})
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm text-foreground">
                    Show Window on Startup
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When off, app starts minimized to tray.
                  </p>
                </div>
                <Switch
                  checked={showOnStartup}
                  onCheckedChange={(checked) => {
                    setShowOnStartup(checked)
                    handleImmediateSave({ show_window_on_startup: checked })
                  }}
                />
              </div>

              <div>
                <Label className="text-sm text-foreground">Theme</Label>
                <div className="mt-2 flex gap-1 rounded-full bg-muted p-1">
                  {(
                    [
                      { value: 'light', icon: Sun, label: 'Light' },
                      { value: 'dark', icon: Moon, label: 'Dark' },
                      { value: 'system', icon: Monitor, label: 'System' }
                    ] as const
                  ).map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      aria-pressed={currentTheme === value}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                        currentTheme === value
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => {
                        setTheme(value)
                        handleImmediateSave({ theme: value })
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">
                OpenStaff v{settings?.app_version ?? '1.0.0'}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={checkingUpdates}
                onClick={handleCheckUpdates}
              >
                {checkingUpdates ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Check for Updates'
                )}
              </Button>
            </div>
            {updateResult && (
              <p className="mt-2 text-sm text-muted-foreground">
                {updateResult.available
                  ? `Update available: v${updateResult.version}. It will be installed on next restart.`
                  : 'You are on the latest version.'}
              </p>
            )}
            <div className="mt-3 flex items-center gap-4">
              <a
                href="https://github.com/koreanthinker/openstaff"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                GitHub
              </a>
              <a
                href="https://github.com/koreanthinker/openstaff#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Documentation
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
