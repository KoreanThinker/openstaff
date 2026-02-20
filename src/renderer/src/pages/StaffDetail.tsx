import { useState, useEffect, useCallback, useRef, useMemo, type CSSProperties } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { parseAnsi, stripAnsi } from '@shared/ansi-parser'
import {
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  Pencil,
  Trash2,
  Search,
  Zap,
  BarChart3,
  ArrowDown,
  Filter,
  X,
  Loader2,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts'
import { api } from '@/lib/api'
import { cn, formatUptime, formatCost, formatTokens, formatTrend } from '@/lib/utils'
import { getSocket } from '@/lib/socket'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

import type { StaffStatus } from '@shared/types'

// ─── Status Dot Component ───────────────────────────────────────────

function StatusDot({ status }: { status: StaffStatus }): React.ReactElement {
  const classes: Record<StaffStatus, string> = {
    running: 'bg-success animate-status-pulse',
    stopped: 'bg-muted-foreground',
    error: 'bg-destructive',
    warning: 'bg-warning'
  }
  return <div className={cn('h-2 w-2 rounded-full', classes[status])} />
}

const STATUS_LABELS: Record<StaffStatus, string> = {
  running: 'Running',
  stopped: 'Stopped',
  error: 'Error',
  warning: 'Warning (Backoff)'
}

// ─── Loop Visualization (Overview) ──────────────────────────────────

function OverviewLoopVisualization({ isRunning }: { isRunning: boolean }): React.ReactElement {
  return (
    <Card className="border border-border">
      <CardContent className="flex items-center justify-center py-8">
        <svg
          viewBox="0 0 300 160"
          className="w-full max-w-xs h-auto"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Arrows */}
          <line x1="95" y1="50" x2="120" y2="50" className="stroke-border" strokeWidth="2" markerEnd="url(#arrowOv)" />
          <line x1="195" y1="50" x2="220" y2="50" className="stroke-border" strokeWidth="2" markerEnd="url(#arrowOv)" />
          <path d="M 265 70 C 265 130, 35 130, 35 70" fill="none" className="stroke-border" strokeWidth="2" markerEnd="url(#arrowOv)" />

          {/* Animated dot */}
          {isRunning && (
            <circle r="3" className="fill-primary">
              <animateMotion
                dur="8s"
                repeatCount="indefinite"
                path="M 55 50 L 155 50 L 255 50 C 265 50, 265 70, 265 70 C 265 130, 35 130, 35 70 C 35 70, 35 50, 55 50"
              />
            </circle>
          )}

          <defs>
            <marker id="arrowOv" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" className="fill-border" />
            </marker>
          </defs>

          {/* Nodes */}
          <foreignObject x="5" y="25" width="90" height="50">
            <div className="flex items-center justify-center gap-1.5 rounded-full bg-chart-1/10 text-chart-1 px-3 py-1.5">
              <Search className="h-3 w-3" />
              <span className="text-xs font-medium">Gather</span>
            </div>
          </foreignObject>
          <foreignObject x="120" y="25" width="90" height="50">
            <div className="flex items-center justify-center gap-1.5 rounded-full bg-chart-2/10 text-chart-2 px-3 py-1.5">
              <Zap className="h-3 w-3" />
              <span className="text-xs font-medium">Execute</span>
            </div>
          </foreignObject>
          <foreignObject x="220" y="25" width="90" height="50">
            <div className="flex items-center justify-center gap-1.5 rounded-full bg-chart-3/10 text-chart-3 px-3 py-1.5">
              <BarChart3 className="h-3 w-3" />
              <span className="text-xs font-medium">Evaluate</span>
            </div>
          </foreignObject>
        </svg>
      </CardContent>
    </Card>
  )
}

// ─── Overview Tab ───────────────────────────────────────────────────

function OverviewTab({ staffId }: { staffId: string }): React.ReactElement {
  const { data: staff } = useQuery({
    queryKey: ['staff', staffId],
    queryFn: () => api.getStaff(staffId)
  })

  const { data: cycles } = useQuery({
    queryKey: ['staff-cycles', staffId],
    queryFn: () => api.getStaffCycles(staffId)
  })

  if (!staff) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  const latestCycle = staff.latest_cycle ?? (cycles?.length ? cycles[cycles.length - 1] : null)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Loop Visualization */}
      <OverviewLoopVisualization isRunning={staff.status === 'running'} />

      {/* Quick Stats */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-lg">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'Cycles', value: String(staff.cycles) },
            { label: 'Uptime', value: formatUptime(staff.uptime) },
            { label: 'Restarts', value: String(staff.restarts) },
            { label: 'Status', value: STATUS_LABELS[staff.status] }
          ].map((stat) => (
            <div key={stat.label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <span className="text-xl font-semibold font-mono text-foreground">{stat.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Staff Configuration */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-lg">Staff Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'GATHER', value: staff.gather },
            { label: 'EXECUTE', value: staff.execute },
            { label: 'EVALUATE', value: staff.evaluate },
            { label: 'KPI', value: staff.kpi || '--' }
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                {item.label}
              </span>
              <p className="text-sm text-foreground line-clamp-3">{item.value}</p>
            </div>
          ))}
          <Separator />
          <div className="flex gap-6">
            <div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Agent</span>
              <p className="text-sm text-foreground">{staff.agent}</p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Model</span>
              <p className="text-sm text-foreground">{staff.model}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Skills + Latest Cycle */}
      <div className="space-y-4">
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Connected Skills</CardTitle>
          </CardHeader>
          <CardContent>
            {staff.skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills connected.</p>
            ) : (
              <div className="space-y-2">
                {staff.skills.map((skill) => (
                  <div key={skill} className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-sm text-foreground">{skill}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Latest Cycle</CardTitle>
          </CardHeader>
          <CardContent>
            {latestCycle ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono">#{latestCycle.cycle}</span>
                  <span>-</span>
                  <span>{latestCycle.date}</span>
                </div>
                <p className="text-sm font-mono text-foreground">{latestCycle.summary}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No cycles completed yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Metrics Tab ────────────────────────────────────────────────────

type TimeRange = '24h' | '7d' | '30d' | 'all'

function MetricsTab({ staffId }: { staffId: string }): React.ReactElement {
  const [range, setRange] = useState<TimeRange>('7d')

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['staff-metrics', staffId, range],
    queryFn: () => api.getStaffMetrics(staffId)
  })

  const filteredMetrics = useMemo(() => {
    if (!metrics) return []
    const now = Date.now()
    const rangeMs: Record<TimeRange, number> = {
      '24h': 24 * 60 * 60_000,
      '7d': 7 * 24 * 60 * 60_000,
      '30d': 30 * 24 * 60 * 60_000,
      'all': Infinity
    }
    const cutoff = rangeMs[range]
    return metrics.filter((entry) => {
      const entryDate = new Date(entry.date).getTime()
      return now - entryDate <= cutoff
    })
  }, [metrics, range])

  const totals = useMemo(() => {
    const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 }
    for (const entry of filteredMetrics) {
      total.input += entry.input_tokens
      total.output += entry.output_tokens
      total.cacheRead += entry.cache_read_tokens
      total.cacheWrite += entry.cache_write_tokens
      total.cost += entry.cost_usd
    }
    return total
  }, [filteredMetrics])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!metrics || metrics.length === 0) {
    return (
      <Card className="border border-border">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <BarChart3 className="h-10 w-10 mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground mb-1">No metrics yet</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Token usage and cost data will appear after the Staff completes its first cycle.
          </p>
        </CardContent>
      </Card>
    )
  }

  const chartData = filteredMetrics.map((entry) => ({
    date: entry.date,
    input: entry.input_tokens,
    output: entry.output_tokens,
    cacheRead: entry.cache_read_tokens,
    cacheWrite: entry.cache_write_tokens,
    cost: entry.cost_usd
  }))

  return (
    <div className="space-y-4">
      {/* Time Range Selector */}
      <div className="flex gap-1 rounded-full bg-muted p-1 w-fit">
        {(['24h', '7d', '30d', 'all'] as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              range === r
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {r === 'all' ? 'All' : r}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Token Usage Area Chart */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Token Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tickFormatter={(v) => formatTokens(v)} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)'
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="input" stackId="1" fill="hsl(var(--chart-1))" stroke="hsl(var(--chart-1))" fillOpacity={0.3} name="Input" />
                <Area type="monotone" dataKey="output" stackId="1" fill="hsl(var(--chart-2))" stroke="hsl(var(--chart-2))" fillOpacity={0.3} name="Output" />
                <Area type="monotone" dataKey="cacheRead" stackId="1" fill="hsl(var(--chart-3))" stroke="hsl(var(--chart-3))" fillOpacity={0.3} name="Cache Read" />
                <Area type="monotone" dataKey="cacheWrite" stackId="1" fill="hsl(var(--chart-4))" stroke="hsl(var(--chart-4))" fillOpacity={0.3} name="Cache Write" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost Bar Chart */}
        <Card className="border border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Cost</CardTitle>
              <Badge variant="secondary" className="rounded-full font-mono">
                Total: {formatCost(totals.cost)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tickFormatter={(v) => `$${v}`} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  formatter={(value: number) => formatCost(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)'
                  }}
                />
                <Bar dataKey="cost" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Cost" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Token Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Input', value: totals.input, color: 'bg-chart-1' },
              { label: 'Output', value: totals.output, color: 'bg-chart-2' },
              { label: 'Cache Read', value: totals.cacheRead, color: 'bg-chart-3' },
              { label: 'Cache Write', value: totals.cacheWrite, color: 'bg-chart-4' }
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full', item.color)} />
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
                <span className="font-mono text-sm text-foreground">{formatTokens(item.value)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Total</span>
              <span className="font-mono text-sm font-semibold text-foreground">
                {formatTokens(totals.input + totals.output + totals.cacheRead + totals.cacheWrite)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Input Tokens', value: totals.cost > 0 ? (totals.input / (totals.input + totals.output + totals.cacheRead + totals.cacheWrite || 1)) * totals.cost : 0, color: 'bg-chart-1' },
              { label: 'Output Tokens', value: totals.cost > 0 ? (totals.output / (totals.input + totals.output + totals.cacheRead + totals.cacheWrite || 1)) * totals.cost : 0, color: 'bg-chart-2' },
              { label: 'Cache Read', value: totals.cost > 0 ? (totals.cacheRead / (totals.input + totals.output + totals.cacheRead + totals.cacheWrite || 1)) * totals.cost : 0, color: 'bg-chart-3' },
              { label: 'Cache Write', value: totals.cost > 0 ? (totals.cacheWrite / (totals.input + totals.output + totals.cacheRead + totals.cacheWrite || 1)) * totals.cost : 0, color: 'bg-chart-4' }
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full', item.color)} />
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
                <span className="font-mono text-sm text-foreground">{formatCost(item.value)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Total</span>
              <span className="font-mono text-sm font-semibold text-foreground">{formatCost(totals.cost)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Logs Tab ───────────────────────────────────────────────────────

function LogsTab({ staffId }: { staffId: string }): React.ReactElement {
  const [lines, setLines] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [logFilter, setLogFilter] = useState<'all' | 'gather' | 'execute' | 'evaluate' | 'errors'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: initialLogs } = useQuery({
    queryKey: ['staff-logs', staffId],
    queryFn: () => api.getStaffLogs(staffId)
  })

  useEffect(() => {
    if (initialLogs?.lines) {
      setLines(initialLogs.lines)
    }
  }, [initialLogs])

  // Subscribe to live log stream
  useEffect(() => {
    const socket = getSocket()
    const handler = (data: { staffId: string; line: string }) => {
      if (data.staffId === staffId) {
        setLines((prev) => {
          const next = [...prev, data.line]
          // Keep buffer limited
          if (next.length > 10_000) return next.slice(-10_000)
          return next
        })
      }
    }
    socket.on('staff:log', handler)
    return () => { socket.off('staff:log', handler) }
  }, [staffId])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines, autoScroll])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
  }, [])

  const jumpToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      setAutoScroll(true)
    }
  }, [])

  const filteredLines = useMemo(() => {
    let result = lines
    if (logFilter !== 'all') {
      const keyword = logFilter === 'errors' ? 'error' : logFilter
      result = result.filter((line) => stripAnsi(line).toLowerCase().includes(keyword))
    }
    if (searchQuery) {
      result = result.filter((line) => stripAnsi(line).toLowerCase().includes(searchQuery.toLowerCase()))
    }
    return result
  }, [lines, logFilter, searchQuery])

  if (lines.length === 0) {
    return (
      <Card className="border border-border">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Search className="h-10 w-10 mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground mb-1">No output yet</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Terminal output will stream here in real-time once the Staff starts running.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-border">
      {/* Search bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search logs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 border-0 bg-transparent focus-visible:ring-0"
        />
        {searchQuery && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSearchQuery('')}>
            <X className="h-3 w-3" />
          </Button>
        )}
        <select
          value={logFilter}
          onChange={(e) => setLogFilter(e.target.value as typeof logFilter)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
        >
          <option value="all">All</option>
          <option value="gather">Gather</option>
          <option value="execute">Execute</option>
          <option value="evaluate">Evaluate</option>
          <option value="errors">Errors</option>
        </select>
        <Button variant="ghost" size="sm" onClick={() => setLines([])}>
          Clear
        </Button>
      </div>

      {/* Terminal viewer */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative h-[500px] overflow-y-auto bg-card p-4"
      >
        <div className="space-y-0.5">
          {filteredLines.map((line, i) => (
            <div key={i} className="font-mono text-xs leading-5 text-foreground whitespace-pre-wrap">
              {parseAnsi(line).map((seg, j) => (
                <span key={j} style={seg.style as CSSProperties}>{seg.text}</span>
              ))}
            </div>
          ))}
        </div>

        {/* Auto-scroll indicator */}
        {!autoScroll && (
          <button
            onClick={jumpToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-soft-float"
          >
            <ArrowDown className="h-3 w-3" />
            Jump to bottom
          </button>
        )}
      </div>

      {/* Status */}
      <div className="flex justify-end border-t border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">
          Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
        </span>
      </div>
    </Card>
  )
}

// ─── KPI Tab ────────────────────────────────────────────────────────

function KpiTab({ staffId }: { staffId: string }): React.ReactElement {
  const { data: staff } = useQuery({
    queryKey: ['staff', staffId],
    queryFn: () => api.getStaff(staffId)
  })

  const { data: kpiData, isLoading } = useQuery({
    queryKey: ['staff-kpi', staffId],
    queryFn: () => api.getStaffKpi(staffId)
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!kpiData || kpiData.length === 0) {
    return (
      <Card className="border border-border">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Zap className="h-10 w-10 mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground mb-1">No KPI data yet</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            KPI metrics will appear after the Staff completes its Evaluate cycles.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Extract unique metric names
  const metricNames = useMemo(() => {
    const names = new Set<string>()
    for (const entry of kpiData) {
      for (const key of Object.keys(entry.metrics)) {
        names.add(key)
      }
    }
    return Array.from(names)
  }, [kpiData])

  // Parse goal values from KPI text
  const goalValues = useMemo(() => {
    if (!staff?.kpi) return {} as Record<string, number>
    const goals: Record<string, number> = {}
    // Simple regex: look for patterns like "metric < value" or "metric > value" or "metric >= value"
    const patterns = staff.kpi.split(',').map((s) => s.trim())
    for (const pattern of patterns) {
      const match = pattern.match(/([a-zA-Z_]+)\s*[<>]=?\s*\$?([\d.]+)/)
      if (match) {
        const name = match[1].toLowerCase()
        goals[name] = parseFloat(match[2])
      }
    }
    return goals
  }, [staff?.kpi])

  return (
    <div className="space-y-4">
      {/* KPI Goal Banner */}
      {staff?.kpi && (
        <div className="rounded-[var(--radius)] bg-muted px-4 py-3">
          <p className="text-sm text-muted-foreground">{staff.kpi}</p>
        </div>
      )}

      {/* Per-metric charts */}
      <div className={cn('grid gap-4', metricNames.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2')}>
        {metricNames.map((metric) => {
          const chartData = kpiData.map((entry) => ({
            date: entry.date,
            value: entry.metrics[metric] ?? null
          })).filter((d) => d.value !== null)

          const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].value : null
          const prevValue = chartData.length > 1 ? chartData[chartData.length - 2].value : null
          const trend = latestValue !== null && prevValue !== null && prevValue !== 0
            ? ((latestValue! - prevValue) / Math.abs(prevValue)) * 100
            : null

          const goalValue = goalValues[metric.toLowerCase()]
          const isMeetingGoal = goalValue != null && latestValue != null && latestValue >= goalValue

          return (
            <Card key={metric} className="border border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg capitalize">
                    {metric.replace(/_/g, ' ')}
                  </CardTitle>
                  {trend !== null && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        'rounded-full',
                        trend >= 0 ? 'text-success' : 'text-destructive'
                      )}
                    >
                      {formatTrend(trend)}
                    </Badge>
                  )}
                </div>
                {latestValue !== null && (
                  <span className="text-3xl font-mono font-bold text-foreground">
                    {latestValue}
                  </span>
                )}
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                    <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius)'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={isMeetingGoal ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-5))'}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name={metric}
                    />
                    {goalValue != null && (
                      <ReferenceLine
                        y={goalValue}
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="5 5"
                        strokeOpacity={0.5}
                        label={{
                          value: `Goal: ${goalValue}`,
                          position: 'right',
                          fill: 'hsl(var(--muted-foreground))',
                          fontSize: 12
                        }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─── Memory Tab ─────────────────────────────────────────────────────

function MemoryTab({ staffId }: { staffId: string }): React.ReactElement {
  const { data: memory, isLoading } = useQuery({
    queryKey: ['staff-memory', staffId],
    queryFn: () => api.getStaffMemory(staffId),
    refetchInterval: 30_000
  })

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  if (!memory?.content) {
    return (
      <Card className="border border-border">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Search className="h-10 w-10 mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground mb-1">No learnings yet</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            The agent will write learnings to memory.md after its first Evaluate cycle.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-border">
      <CardHeader>
        <CardTitle className="text-lg">Agent Memory</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {/* Simple markdown rendering - renders line-by-line without react-markdown */}
            {memory.content.split('\n').map((line, i) => {
              if (line.startsWith('### ')) {
                return <h3 key={i} className="text-base font-semibold text-foreground mt-4 mb-2">{line.slice(4)}</h3>
              }
              if (line.startsWith('## ')) {
                return <h2 key={i} className="text-lg font-semibold text-foreground mt-6 mb-3">{line.slice(3)}</h2>
              }
              if (line.startsWith('# ')) {
                return <h1 key={i} className="text-xl font-bold text-foreground mt-6 mb-3">{line.slice(2)}</h1>
              }
              if (line.startsWith('- ')) {
                return (
                  <div key={i} className="flex gap-2 text-sm text-foreground ml-2">
                    <span className="text-muted-foreground">-</span>
                    <span>{line.slice(2)}</span>
                  </div>
                )
              }
              if (line.trim() === '') {
                return <div key={i} className="h-2" />
              }
              return <p key={i} className="text-sm text-foreground">{line}</p>
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ─── Errors Tab ─────────────────────────────────────────────────────

const ERROR_TYPE_STYLES: Record<string, string> = {
  process_crash: 'bg-destructive/10 text-destructive',
  api_error: 'bg-warning/10 text-warning',
  health_check: 'bg-warning/10 text-warning',
  giveup: 'bg-destructive/10 text-destructive'
}

function ErrorsTab({ staffId }: { staffId: string }): React.ReactElement {
  const [filter, setFilter] = useState<string>('all')
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const { data: errorData, isLoading } = useQuery({
    queryKey: ['staff-errors', staffId],
    queryFn: () => api.getStaffErrors(staffId)
  })

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  const errors = errorData ?? []
  const filteredErrors = filter === 'all'
    ? errors
    : errors.filter((e) => e.type === filter)

  // Reverse chronological
  const sortedErrors = [...filteredErrors].reverse()

  if (errors.length === 0) {
    return (
      <Card className="border border-border">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="h-10 w-10 mb-3 rounded-full bg-success/10 flex items-center justify-center">
            <Zap className="h-5 w-5 text-success" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">All clear</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            No errors recorded. Your Staff is running smoothly.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with count + filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">Errors</h3>
          <Badge variant="secondary" className="rounded-full bg-destructive/10 text-destructive">
            {errors.length}
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-full">
              <Filter className="mr-2 h-3 w-3" />
              {filter === 'all' ? 'All Types' : filter}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {['all', 'process_crash', 'api_error', 'health_check', 'giveup'].map((type) => (
              <DropdownMenuItem key={type} onClick={() => setFilter(type)}>
                {type === 'all' ? 'All Types' : type}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Error List */}
      <Card className="border border-border">
        <CardContent className="divide-y divide-border p-0">
          {sortedErrors.map((error, i) => (
            <div
              key={i}
              className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                  {new Date(error.timestamp).toLocaleString()}
                </span>
                <Badge
                  variant="secondary"
                  className={cn('rounded-full text-xs font-medium', ERROR_TYPE_STYLES[error.type] ?? '')}
                >
                  {error.type}
                </Badge>
              </div>
              <p className={cn(
                'mt-1 text-sm text-foreground',
                expandedIndex !== i && 'line-clamp-2'
              )}>
                {error.message}
              </p>
              {error.details && expandedIndex === i && (
                <pre className="mt-2 rounded-sm bg-muted p-2 font-mono text-xs text-muted-foreground overflow-x-auto">
                  {error.details}
                </pre>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main StaffDetail Component ─────────────────────────────────────

export function StaffDetail(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const staffId = id!

  const activeTab = searchParams.get('tab') ?? 'overview'
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // ─── Data Fetching ──────────────────────────────────────────────

  const { data: staff, isLoading, isError } = useQuery({
    queryKey: ['staff', staffId],
    queryFn: () => api.getStaff(staffId),
    refetchInterval: 5000
  })

  const { data: errors } = useQuery({
    queryKey: ['staff-errors', staffId],
    queryFn: () => api.getStaffErrors(staffId),
    refetchInterval: 10000
  })

  const errorCount = errors?.length ?? 0

  // ─── WebSocket status updates ─────────────────────────────────

  useEffect(() => {
    const socket = getSocket()
    const handler = (data: { staffId: string; status: StaffStatus }) => {
      if (data.staffId === staffId) {
        queryClient.invalidateQueries({ queryKey: ['staff', staffId] })
      }
    }
    socket.on('staff:status', handler)
    return () => { socket.off('staff:status', handler) }
  }, [staffId, queryClient])

  // ─── Actions ──────────────────────────────────────────────────

  const startMutation = useMutation({
    mutationFn: () => api.startStaff(staffId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff', staffId] })
  })

  const stopMutation = useMutation({
    mutationFn: () => api.stopStaff(staffId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff', staffId] })
  })

  const restartMutation = useMutation({
    mutationFn: () => api.restartStaff(staffId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff', staffId] })
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteStaff(staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffs'] })
      navigate('/')
    }
  })

  const handleTabChange = useCallback((tab: string) => {
    setSearchParams({ tab })
  }, [setSearchParams])

  // ─── Error / Not Found ────────────────────────────────────────

  useEffect(() => {
    if (isError) navigate('/')
  }, [isError, navigate])

  if (isError) return <></>

  // ─── Loading ──────────────────────────────────────────────────

  if (isLoading || !staff) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const _isRunning = staff.status === 'running'
  const isStopped = staff.status === 'stopped'
  const isActionLoading = startMutation.isPending || stopMutation.isPending || restartMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <h1 className="text-2xl font-semibold text-foreground">{staff.name}</h1>

          <div className="flex items-center gap-2">
            <StatusDot status={staff.status} />
            <span className="text-sm text-muted-foreground">{STATUS_LABELS[staff.status]}</span>
            {staff.uptime !== null && staff.status !== 'stopped' && (
              <span className="text-sm font-mono text-muted-foreground">
                {formatUptime(staff.uptime)}
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground ml-11">{staff.role}</p>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 ml-11">
          {isStopped ? (
            <Button
              onClick={() => startMutation.mutate()}
              disabled={isActionLoading}
            >
              {startMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => stopMutation.mutate()}
                disabled={isActionLoading}
              >
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
              <Button
                variant="outline"
                onClick={() => restartMutation.mutate()}
                disabled={isActionLoading}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restart
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            onClick={() => navigate(`/staffs/${staffId}/edit`)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="kpi">KPI</TabsTrigger>
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="errors">
            Errors
            {errorCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-5 min-w-5 rounded-full px-1.5 text-xs">
                {errorCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab staffId={staffId} />
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <MetricsTab staffId={staffId} />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <LogsTab staffId={staffId} />
        </TabsContent>

        <TabsContent value="kpi" className="mt-4">
          <KpiTab staffId={staffId} />
        </TabsContent>

        <TabsContent value="memory" className="mt-4">
          <MemoryTab staffId={staffId} />
        </TabsContent>

        <TabsContent value="errors" className="mt-4">
          <ErrorsTab staffId={staffId} />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Staff</DialogTitle>
            <DialogDescription>
              This will permanently delete this Staff and all its data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDeleteDialog(false)
                deleteMutation.mutate()
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
