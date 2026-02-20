import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect, createElement, useCallback } from 'react'
import {
  Users,
  DollarSign,
  Calendar,
  RotateCcw,
  Plus,
  MoreHorizontal,
  Play,
  Square,
  RefreshCw,
  Eye,
  Trash2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatUptime, formatCost, formatTokens, formatTrend } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { toast } from '@/hooks/use-toast'
import { useHeaderActionStore } from '@/stores/header-action-store'
import type { StaffSummary, DashboardStats, SystemResources, StaffStatus } from '@shared/types'

function StatusDot({ status }: { status: StaffStatus }): React.ReactElement {
  return (
    <div
      className={cn(
        'h-2 w-2 rounded-full',
        status === 'running' && 'bg-success animate-status-pulse',
        status === 'stopped' && 'bg-muted-foreground',
        status === 'paused' && 'bg-warning',
        status === 'error' && 'bg-destructive',
        status === 'warning' && 'bg-warning'
      )}
    />
  )
}

function TrendBadge({ trend }: { trend: number | null }): React.ReactElement {
  if (trend === null) return <span className="text-xs text-muted-foreground">--</span>
  const isPositive = trend >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        isPositive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
      )}
    >
      {formatTrend(trend)}
    </span>
  )
}

function SummaryCard({
  title,
  value,
  trend,
  icon: Icon,
  subtitle,
  highlighted
}: {
  title: string
  value: string | number
  trend: number | null
  icon: React.ElementType
  subtitle?: React.ReactNode
  highlighted?: boolean
}): React.ReactElement {
  return (
    <Card className={cn(highlighted && 'border-success/30 bg-success/5')}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={cn('h-4 w-4', highlighted ? 'text-success' : 'text-muted-foreground')} />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className={cn('text-2xl font-bold', highlighted && 'text-3xl')}>{value}</div>
          <TrendBadge trend={trend} />
        </div>
        {subtitle && <p className="mt-1 text-xs">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

function ResourceBar({ label, percent }: { label: string; percent: number }): React.ReactElement {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{percent.toFixed(0)}%</span>
      </div>
      <Progress value={percent} className="h-2" />
    </div>
  )
}

function StaffActions({
  staff,
  onAction
}: {
  staff: StaffSummary
  onAction: (action: string, id: string) => void
}): React.ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Staff actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {staff.status === 'running' ? (
          <DropdownMenuItem onClick={() => onAction('stop', staff.id)}>
            <Square className="mr-2 h-4 w-4" />
            Stop
          </DropdownMenuItem>
        ) : staff.status === 'paused' ? (
          <DropdownMenuItem onClick={() => onAction('resume', staff.id)}>
            <Play className="mr-2 h-4 w-4" />
            Resume
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onAction('start', staff.id)}>
            <Play className="mr-2 h-4 w-4" />
            Start
          </DropdownMenuItem>
        )}
        {staff.status !== 'paused' && (
          <DropdownMenuItem onClick={() => onAction('restart', staff.id)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Restart
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onAction('view', staff.id)}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => onAction('delete', staff.id)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EmptyState(): React.ReactElement {
  const navigate = useNavigate()
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-lg font-semibold">No Staff yet</h3>
        <p className="mb-6 text-sm text-muted-foreground">
          Create your first Staff to get started with autonomous AI agents.
        </p>
        <Button className="rounded-full" onClick={() => navigate('/staffs/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Create Staff
        </Button>
      </CardContent>
    </Card>
  )
}

function FilterEmptyState({ onReset }: { onReset: () => void }): React.ReactElement {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <h3 className="mb-1 text-lg font-semibold">No matching Staff</h3>
        <p className="mb-5 text-sm text-muted-foreground">
          No Staff match the current search or filter settings.
        </p>
        <Button variant="outline" className="rounded-full" onClick={onReset}>
          Clear Filters
        </Button>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Staff table skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
      <Card>
        <CardContent className="p-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
              <div className="ml-auto flex gap-4">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

type SortField = 'name' | 'status' | 'cycles' | 'cost'
type SortDir = 'asc' | 'desc'

export function Dashboard(): React.ReactElement {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const setActionButton = useHeaderActionStore((s) => s.setActionButton)

  // Set header action button
  useEffect(() => {
    setActionButton(
      createElement(Button, {
        size: 'sm',
        className: 'rounded-full gap-2',
        onClick: () => navigate('/staffs/new')
      }, createElement(Plus, { className: 'h-4 w-4' }), 'Create Staff')
    )
    return () => setActionButton(null)
  }, [setActionButton, navigate])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const statsQuery = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.getDashboardStats(),
    refetchInterval: 5000
  })

  const staffsQuery = useQuery<StaffSummary[]>({
    queryKey: ['staffs'],
    queryFn: () => api.getStaffs(),
    refetchInterval: 5000
  })

  const resourcesQuery = useQuery<SystemResources>({
    queryKey: ['system-resources'],
    queryFn: () => api.getSystemResources(),
    refetchInterval: 10000
  })

  const stats = statsQuery.data
  const staffs = staffsQuery.data ?? []
  const resources = resourcesQuery.data

  const handleAction = useCallback(async (action: string, staffId: string): Promise<void> => {
    try {
      switch (action) {
        case 'start':
          await api.startStaff(staffId)
          toast({ title: 'Staff started' })
          break
        case 'stop':
          await api.stopStaff(staffId)
          toast({ title: 'Staff stopped' })
          break
        case 'restart':
          await api.restartStaff(staffId)
          toast({ title: 'Staff restarted' })
          break
        case 'resume':
          await api.resumeStaff(staffId)
          toast({ title: 'Staff resumed' })
          break
        case 'view':
          navigate(`/staffs/${staffId}`)
          return
        case 'delete': {
          const name = staffs.find((s) => s.id === staffId)?.name ?? 'this staff'
          setDeleteTarget({ id: staffId, name })
          return
        }
      }
      await staffsQuery.refetch()
      await statsQuery.refetch()
    } catch (err) {
      toast({
        title: 'Action failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive'
      })
    }
  }, [navigate, staffs, staffsQuery, statsQuery])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await api.deleteStaff(deleteTarget.id)
      toast({ title: 'Staff deleted' })
      setDeleteTarget(null)
      await staffsQuery.refetch()
      await statsQuery.refetch()
    } catch (err) {
      toast({
        title: 'Failed to delete',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, staffsQuery, statsQuery])

  const filteredStaffs = useMemo(() => {
    let result = staffs
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.role.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter)
    }
    result = [...result].sort((a, b) => {
      const cmp = sortField === 'status'
        ? a.status.localeCompare(b.status)
        : sortField === 'cycles'
          ? a.cycles - b.cycles
          : sortField === 'cost'
            ? a.cost_today - b.cost_today
            : a.name.localeCompare(b.name)
      return sortDir === 'desc' ? -cmp : cmp
    })
    return result
  }, [staffs, search, statusFilter, sortField, sortDir])

  if (statsQuery.isLoading || staffsQuery.isLoading) {
    return <DashboardSkeleton />
  }

  if (statsQuery.isError || staffsQuery.isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <p className="mb-4 text-sm text-destructive">
            Failed to load dashboard data. The API server may be unavailable.
          </p>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              statsQuery.refetch()
              staffsQuery.refetch()
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Active Staff"
          value={`${stats?.active_staffs ?? 0} / ${stats?.total_staffs ?? 0}`}
          trend={null}
          icon={Users}
          highlighted
          subtitle={stats?.error_staffs ? (
            <span className="text-destructive">{stats.error_staffs} error{stats.error_staffs > 1 ? 's' : ''}</span>
          ) : undefined}
        />
        <SummaryCard
          title="Cost Today"
          value={formatCost(stats?.cost_today ?? 0)}
          trend={stats?.cost_today_trend ?? null}
          icon={DollarSign}
        />
        <SummaryCard
          title="Cost This Month"
          value={formatCost(stats?.cost_month ?? 0)}
          trend={stats?.cost_month_trend ?? null}
          icon={Calendar}
        />
        <SummaryCard
          title="Total Cycles"
          value={stats?.total_cycles ?? 0}
          trend={stats?.cycles_trend ?? null}
          icon={RotateCcw}
        />
      </div>

      {/* System Resources */}
      {resources && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ResourceBar label="CPU" percent={resources.cpu_percent} />
            <ResourceBar
              label={`Memory (${(resources.memory_used_mb / 1024).toFixed(1)} / ${(resources.memory_total_mb / 1024).toFixed(1)} GB)`}
              percent={resources.memory_percent}
            />
          </CardContent>
        </Card>
      )}

      {/* Staff List */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Staff</h2>
      </div>

      {/* Search, Filter, Sort */}
      {staffs.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-full pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] rounded-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="stopped">Stopped</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
            <SelectTrigger className="w-[140px] rounded-full">
              <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="cycles">Cycles</SelectItem>
              <SelectItem value="cost">Cost</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {staffs.length === 0 ? (
        <EmptyState />
      ) : filteredStaffs.length === 0 ? (
        <FilterEmptyState
          onReset={() => {
            setSearch('')
            setStatusFilter('all')
          }}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead role="button" tabIndex={0} aria-sort={sortField === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined} className={cn('w-10 cursor-pointer select-none transition-colors hover:bg-muted/60', sortField === 'status' && 'bg-muted/40 text-foreground')} onClick={() => toggleSort('status')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('status') } }}>
                    <span className="inline-flex items-center gap-1">Status{sortField === 'status' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50" />}</span>
                  </TableHead>
                  <TableHead role="button" tabIndex={0} aria-sort={sortField === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined} className={cn('cursor-pointer select-none transition-colors hover:bg-muted/60', sortField === 'name' && 'bg-muted/40 text-foreground')} onClick={() => toggleSort('name')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('name') } }}>
                    <span className="inline-flex items-center gap-1">Name{sortField === 'name' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50" />}</span>
                  </TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Memory</TableHead>
                  <TableHead>Uptime</TableHead>
                  <TableHead className="text-right">Restarts</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead role="button" tabIndex={0} aria-sort={sortField === 'cost' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined} className={cn('cursor-pointer select-none text-right transition-colors hover:bg-muted/60', sortField === 'cost' && 'bg-muted/40 text-foreground')} onClick={() => toggleSort('cost')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('cost') } }}>
                    <span className="inline-flex items-center justify-end gap-1 w-full">Cost{sortField === 'cost' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50" />}</span>
                  </TableHead>
                  <TableHead role="button" tabIndex={0} aria-sort={sortField === 'cycles' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined} className={cn('cursor-pointer select-none text-right transition-colors hover:bg-muted/60', sortField === 'cycles' && 'bg-muted/40 text-foreground')} onClick={() => toggleSort('cycles')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('cycles') } }}>
                    <span className="inline-flex items-center justify-end gap-1 w-full">Cycles{sortField === 'cycles' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50" />}</span>
                  </TableHead>
                  <TableHead>KPI</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaffs.map((staff) => (
                  <TableRow
                    key={staff.id}
                    className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    tabIndex={0}
                    role="link"
                    aria-label={`View details for ${staff.name}`}
                    onClick={() => navigate(`/staffs/${staff.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate(`/staffs/${staff.id}`)
                      }
                    }}
                  >
                    <TableCell>
                      <StatusDot status={staff.status} />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium">{staff.name}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-muted-foreground">{staff.role}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {staff.agent}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{staff.model}</TableCell>
                    <TableCell
                      className="max-w-[220px] truncate text-xs text-muted-foreground"
                      title={staff.memory_preview ?? undefined}
                    >
                      {staff.memory_preview ?? '--'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatUptime(staff.uptime)}
                    </TableCell>
                    <TableCell className="text-right">{staff.restarts}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatTokens(staff.tokens_today)}
                    </TableCell>
                    <TableCell className="text-right">{formatCost(staff.cost_today)}</TableCell>
                    <TableCell className="text-right">{staff.cycles}</TableCell>
                    <TableCell>
                      {staff.kpi_summary.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {staff.kpi_summary.slice(0, 2).map((kpi) => (
                            <div key={kpi.name} className="flex items-center gap-1 text-xs">
                              <span className="text-muted-foreground">{kpi.name}:</span>
                              <span className="font-medium">{kpi.value}</span>
                              <TrendBadge trend={kpi.trend} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <StaffActions staff={staff} onAction={handleAction} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {filteredStaffs.map((staff) => (
              <Card
                key={staff.id}
                className="cursor-pointer transition-colors hover:border-foreground/20 active:scale-[0.99]"
                tabIndex={0}
                role="link"
                aria-label={`View details for ${staff.name}`}
                onClick={() => navigate(`/staffs/${staff.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/staffs/${staff.id}`)
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusDot status={staff.status} />
                      <div>
                        <div className="font-medium">{staff.name}</div>
                        <div className="text-xs text-muted-foreground">{staff.role}</div>
                        {staff.memory_preview && (
                          <div className="max-w-[220px] truncate text-xs text-muted-foreground/90">
                            {staff.memory_preview}
                          </div>
                        )}
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <StaffActions staff={staff} onAction={handleAction} />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground">Cycles</div>
                      <div className="text-sm font-medium">{staff.cycles}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Cost</div>
                      <div className="text-sm font-medium">{formatCost(staff.cost_today)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Uptime</div>
                      <div className="text-sm font-medium">{formatUptime(staff.uptime)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Staff</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{deleteTarget?.name}&rdquo;? This will stop the staff and remove all data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
