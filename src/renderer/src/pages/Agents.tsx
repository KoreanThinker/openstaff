import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Cpu,
  Eye,
  EyeOff,
  Loader2,
  Check,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { api } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { cn, formatTokens, formatCost, formatTrend } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import type {
  AgentInfo,
  AgentModel,
  AgentUsage,
  AgentBudget,
  AgentUsageBreakdown
} from '@shared/types'

function AgentStatusPill({
  status
}: {
  status: AgentInfo['status']
}): React.ReactElement {
  const config: Record<
    AgentInfo['status'],
    { label: string; className: string }
  > = {
    connected: { label: 'Connected', className: 'bg-success/15 text-success' },
    disconnected: {
      label: 'Disconnected',
      className: 'bg-destructive/15 text-destructive'
    },
    not_installed: {
      label: 'Not Installed',
      className: 'bg-muted text-muted-foreground'
    },
    installing: {
      label: 'Installing',
      className: 'bg-warning/15 text-warning'
    },
    updating: { label: 'Updating', className: 'bg-warning/15 text-warning' }
  }
  const c = config[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        c.className
      )}
    >
      {(status === 'installing' || status === 'updating') && (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {c.label}
    </span>
  )
}

function ConnectionStatusDot({
  status
}: {
  status: 'connected' | 'disconnected' | 'not_tested'
}): React.ReactElement {
  const dotClass =
    status === 'connected'
      ? 'bg-success'
      : status === 'disconnected'
        ? 'bg-destructive'
        : 'bg-muted-foreground'
  const textClass =
    status === 'connected'
      ? 'text-success'
      : status === 'disconnected'
        ? 'text-destructive'
        : 'text-muted-foreground'
  const label =
    status === 'connected'
      ? 'Connected -- API key valid'
      : status === 'disconnected'
        ? 'Disconnected -- invalid or missing key'
        : 'Not tested'
  return (
    <div className="flex items-center gap-2">
      <div className={cn('h-2 w-2 rounded-full', dotClass)} />
      <span className={cn('text-sm', textClass)}>{label}</span>
    </div>
  )
}

function GuidedSetup({
  agent,
  onInstallComplete,
  onConnected
}: {
  agent: AgentInfo
  onInstallComplete: () => void
  onConnected: () => void
}): React.ReactElement {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [installProgress, setInstallProgress] = useState(0)
  const [testStatus, setTestStatus] = useState<
    'idle' | 'testing' | 'success' | 'failed'
  >('idle')
  const queryClient = useQueryClient()

  const installMutation = useMutation({
    mutationFn: () => api.installAgent(agent.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      onInstallComplete()
    }
  })

  const testMutation = useMutation({
    mutationFn: async () => {
      await api.updateAgentApiKey(agent.id, apiKey)
      const result = await api.testAgentConnection(agent.id)
      return result.connected
    },
    onSuccess: (connected) => {
      setTestStatus(connected ? 'success' : 'failed')
      if (connected) {
        queryClient.invalidateQueries({ queryKey: ['agents'] })
        onConnected()
      }
    },
    onError: () => setTestStatus('failed')
  })

  useEffect(() => {
    const socket = getSocket()
    const handler = (data: { percent: number }) => {
      setInstallProgress(data.percent)
    }
    socket.on('agent:install:progress', handler)
    return () => {
      socket.off('agent:install:progress', handler)
    }
  }, [])

  const step1Done = agent.installed
  const step2Done = agent.connected
  const step3Done = step1Done && step2Done

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 pb-4">
          <Cpu className="h-8 w-8 text-foreground" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Set up your first AI Agent
            </h2>
            <p className="text-sm text-muted-foreground">
              OpenStaff needs an AI agent to power your Staff. Let&apos;s get
              Claude Code set up.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Step 1 */}
          <div
            className={cn(
              'rounded-lg border border-border p-4',
              step1Done && 'bg-muted/50'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                  step1Done
                    ? 'bg-success/15 text-success'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {step1Done ? <Check className="h-4 w-4" /> : '1'}
              </div>
              <span className="text-sm font-medium text-foreground">
                Install Claude Code
              </span>
            </div>
            {!step1Done && (
              <div className="mt-3 pl-10">
                {installMutation.isPending ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Installing Claude Code...
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-success transition-all"
                          style={{ width: `${installProgress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {installProgress}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => installMutation.mutate()}>
                    Install
                  </Button>
                )}
                {installMutation.isError && (
                  <p className="mt-2 text-sm text-destructive">
                    Installation failed. Please try again.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Step 2 */}
          <div
            className={cn(
              'rounded-lg border border-border p-4',
              step2Done && 'bg-muted/50',
              !step1Done && 'opacity-50'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                  step2Done
                    ? 'bg-success/15 text-success'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {step2Done ? <Check className="h-4 w-4" /> : '2'}
              </div>
              <span className="text-sm font-medium text-foreground">
                Enter your API Key
              </span>
            </div>
            {step1Done && !step2Done && (
              <div className="mt-3 pl-10">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      placeholder="Enter your Anthropic API key"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value)
                        setTestStatus('idle')
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    disabled={!apiKey.trim() || testMutation.isPending}
                    onClick={() => {
                      setTestStatus('testing')
                      testMutation.mutate()
                    }}
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Test
                  </Button>
                </div>
                {testStatus === 'failed' && (
                  <p className="mt-2 text-sm text-destructive">
                    Invalid key. Please check and try again.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Step 3 */}
          <div
            className={cn(
              'rounded-lg border border-border p-4',
              step3Done && 'bg-muted/50',
              !step2Done && 'opacity-50'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                  step3Done
                    ? 'bg-success/15 text-success'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {step3Done ? <Check className="h-4 w-4" /> : '3'}
              </div>
              <span className="text-sm font-medium text-foreground">
                Ready!
              </span>
            </div>
            {step3Done && (
              <div className="mt-3 pl-10">
                <p className="text-sm text-success">
                  Agent installed and connected.
                </p>
                <Button variant="link" className="mt-1 h-auto p-0 text-sm" asChild>
                  <a href="/staffs/new">Create your first Staff</a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ClaudeCodeCard({
  agent
}: {
  agent: AgentInfo
}): React.ReactElement {
  const queryClient = useQueryClient()
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'disconnected' | 'not_tested'
  >(agent.connected ? 'connected' : agent.api_key_configured ? 'disconnected' : 'not_tested')
  const [autoUpdate, setAutoUpdate] = useState(false)

  const testMutation = useMutation({
    mutationFn: async () => {
      if (apiKey.trim()) {
        await api.updateAgentApiKey(agent.id, apiKey)
      }
      const result = await api.testAgentConnection(agent.id)
      return result.connected
    },
    onSuccess: (connected) => {
      setConnectionStatus(connected ? 'connected' : 'disconnected')
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
    onError: () => setConnectionStatus('disconnected')
  })

  // Simulated usage/budget data (would come from API in production)
  const [budget, setBudget] = useState<AgentBudget>({
    monthly_limit: null,
    warning_threshold: 80
  })

  return (
    <Card>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Cpu className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Claude Code
              </h2>
            </div>
            <span className="font-mono text-sm text-muted-foreground">
              {agent.version ?? '--'}
            </span>
          </div>
          <AgentStatusPill status={agent.status} />
        </div>

        <div className="mt-6 space-y-6">
          {/* Connection & Auth */}
          <div className="rounded-lg bg-muted/50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              Connection
            </h3>
            <div className="mt-3 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">API Key</Label>
                <div className="mt-1 flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      placeholder="Enter your Anthropic API key"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value)
                        setConnectionStatus('not_tested')
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    disabled={testMutation.isPending}
                    onClick={() => testMutation.mutate()}
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Test
                  </Button>
                </div>
              </div>
              <ConnectionStatusDot status={connectionStatus} />
            </div>
          </div>

          {/* Installation */}
          <div className="rounded-lg bg-muted/50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              Installation
            </h3>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">
                  Status:{' '}
                  <span className="font-medium">
                    {agent.installed ? 'Installed' : 'Not Installed'}
                  </span>
                </p>
                {agent.version && (
                  <p className="font-mono text-sm text-muted-foreground">
                    v{agent.version}
                  </p>
                )}
              </div>
              {agent.installed && (
                <Button variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Check for Updates
                </Button>
              )}
            </div>
            {agent.installed && (
              <div className="mt-3 flex items-center gap-2">
                <Label htmlFor="auto-update" className="text-sm text-foreground">
                  Auto-update
                </Label>
                <Switch
                  id="auto-update"
                  checked={autoUpdate}
                  onCheckedChange={setAutoUpdate}
                />
              </div>
            )}
          </div>

          {/* Available Models */}
          {agent.models.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                Available Models
              </h3>
              <div className="mt-3 flex flex-wrap gap-3">
                {agent.models.map((model) => (
                  <div
                    key={model.id}
                    className="rounded-lg bg-muted px-4 py-2"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {model.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {model.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Usage Overview */}
          {agent.connected && (
            <div className="rounded-lg bg-muted/50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                Usage
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <UsageCard label="Today" tokens={0} cost={0} trend={null} />
                <UsageCard
                  label="This Month"
                  tokens={0}
                  cost={0}
                  trend={null}
                />
              </div>
            </div>
          )}

          {/* Budget */}
          {agent.connected && (
            <div className="rounded-lg bg-muted/50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                Budget
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Monthly Limit
                  </Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      placeholder="No limit"
                      className="pl-7"
                      value={budget.monthly_limit ?? ''}
                      onChange={(e) =>
                        setBudget((prev) => ({
                          ...prev,
                          monthly_limit: e.target.value
                            ? Number(e.target.value)
                            : null
                        }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Warning Threshold
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      value={budget.warning_threshold}
                      onChange={(e) =>
                        setBudget((prev) => ({
                          ...prev,
                          warning_threshold: Number(e.target.value)
                        }))
                      }
                      className="pr-7"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              </div>
              {budget.monthly_limit === null && (
                <p className="mt-3 text-sm text-muted-foreground">
                  No monthly limit set.
                </p>
              )}
              {budget.monthly_limit !== null && (
                <div className="mt-3">
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-success transition-all"
                      style={{ width: '0%' }}
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    $0.00 of {formatCost(budget.monthly_limit)} used
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Staff Usage Breakdown */}
          {agent.connected && (
            <div className="rounded-lg bg-muted/50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                Usage by Staff
              </h3>
              <p className="mt-3 text-sm text-muted-foreground">
                No Staff are using this agent.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function UsageCard({
  label,
  tokens,
  cost,
  trend
}: {
  label: string
  tokens: number
  cost: number
  trend: number | null
}): React.ReactElement {
  return (
    <div className="rounded-lg bg-muted p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-foreground">
        {formatTokens(tokens)}
      </p>
      <p className="text-lg font-medium text-foreground">{formatCost(cost)}</p>
      {trend !== null && (
        <div className="mt-1 flex items-center gap-1">
          {trend >= 0 ? (
            <TrendingUp className="h-3 w-3 text-success" />
          ) : (
            <TrendingDown className="h-3 w-3 text-destructive" />
          )}
          <span
            className={cn(
              'text-xs',
              trend >= 0 ? 'text-success' : 'text-destructive'
            )}
          >
            {formatTrend(trend)}
          </span>
        </div>
      )}
    </div>
  )
}

export function Agents(): React.ReactElement {
  const {
    data: agents,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents
  })

  const claudeCode = agents?.find((a) => a.id === 'claude-code')
  const codex = agents?.find((a) => a.id === 'codex')

  const isFirstSetup =
    claudeCode &&
    !claudeCode.installed &&
    !claudeCode.api_key_configured

  return (
    <div className="flex flex-1 flex-col">
      <div className="p-6 pb-4">
        <h1 className="text-2xl font-semibold text-foreground">Agents</h1>
      </div>

      <div className="flex-1 space-y-6 overflow-auto px-6 pb-6">
        {isLoading && (
          <div className="space-y-6">
            <Skeleton className="h-80 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">Could not load agent data.</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && claudeCode && (
          <>
            {isFirstSetup ? (
              <GuidedSetup
                agent={claudeCode}
                onInstallComplete={() => {}}
                onConnected={() => {}}
              />
            ) : (
              <ClaudeCodeCard agent={claudeCode} />
            )}
          </>
        )}

        {/* Codex Placeholder */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <Cpu className="h-5 w-5 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">
                  Codex
                </h2>
                <span className="font-mono text-sm text-muted-foreground">
                  --
                </span>
              </div>
              <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                Coming Soon
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Coming soon. Codex support is planned for a future release.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
