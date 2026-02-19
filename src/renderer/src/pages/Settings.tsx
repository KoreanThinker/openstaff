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
  const [showNgrokKey, setShowNgrokKey] = useState(false)
  const [showNgrokPassword, setShowNgrokPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [defaultAgent, setDefaultAgent] = useState('claude-code')
  const [defaultModel, setDefaultModel] = useState('claude-sonnet-4-5')
  const [startOnLogin, setStartOnLogin] = useState(false)
  const [showOnStartup, setShowOnStartup] = useState(true)

  // Sync from API
  useEffect(() => {
    if (settings) {
      setNgrokKey(settings.ngrok_api_key || '')
      setNgrokPassword(settings.ngrok_auth_password || '')
      setDefaultAgent(settings.default_agent || 'claude-code')
      setDefaultModel(settings.default_model || 'claude-sonnet-4-5')
      setStartOnLogin(settings.start_on_login ?? false)
      setShowOnStartup(settings.show_window_on_startup ?? true)
    }
  }, [settings])

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
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const handleCheckUpdates = useCallback(() => {
    setCheckingUpdates(true)
    setTimeout(() => setCheckingUpdates(false), 3000)
  }, [])

  // Get available models for the selected agent
  const availableModels = agents?.find((a) => a.id === defaultAgent)?.models || []

  // Query ngrok status from system API
  const { data: ngrokStatus } = useQuery({
    queryKey: ['ngrok-status'],
    queryFn: () => api.get('/api/system/ngrok') as Promise<{
      ngrok_status: string
      ngrok_url: string | null
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
                      agents?.find((a) => a.id === value)?.models[0]?.id ||
                      ''
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
                    <SelectItem value="claude-code">Claude Code</SelectItem>
                    <SelectItem value="codex" disabled>
                      Codex (Coming soon)
                    </SelectItem>
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
                    {availableModels.length === 0 && (
                      <>
                        <SelectItem value="claude-sonnet-4-5">
                          Claude Sonnet 4.5
                        </SelectItem>
                        <SelectItem value="claude-opus-4-6">
                          Claude Opus 4.6
                        </SelectItem>
                        <SelectItem value="claude-haiku-4-5">
                          Claude Haiku 4.5
                        </SelectItem>
                      </>
                    )}
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
