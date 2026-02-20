import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { Zap } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatTrend } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export function StaffKpiTab({ staffId }: { staffId: string }): React.ReactElement {
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
          <Zap className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="mb-1 text-sm font-medium text-foreground">No KPI data yet</p>
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            KPI metrics will appear after the Staff completes its Evaluate cycles.
          </p>
        </CardContent>
      </Card>
    )
  }

  const metricNames = useMemo(() => {
    const names = new Set<string>()
    for (const entry of kpiData) {
      for (const key of Object.keys(entry.metrics)) {
        names.add(key)
      }
    }
    return Array.from(names)
  }, [kpiData])

  const goalValues = useMemo(() => {
    if (!staff?.kpi) return {} as Record<string, number>
    const goals: Record<string, number> = {}
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
      {staff?.kpi && (
        <div className="rounded-[var(--radius)] bg-muted px-4 py-3">
          <p className="text-sm text-muted-foreground">{staff.kpi}</p>
        </div>
      )}

      <div className={cn('grid gap-4', metricNames.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2')}>
        {metricNames.map((metric) => {
          const chartData = kpiData
            .map((entry) => ({
              date: entry.date,
              value: entry.metrics[metric] ?? null
            }))
            .filter((d) => d.value !== null)

          const latestValue = chartData.at(-1)?.value ?? null
          const prevValue = chartData.at(-2)?.value ?? null
          const trend =
            latestValue !== null && prevValue !== null && prevValue !== 0
              ? ((latestValue - prevValue) / Math.abs(prevValue)) * 100
              : null

          const goalValue = goalValues[metric.toLowerCase()]
          const isMeetingGoal = goalValue != null && latestValue != null && latestValue >= goalValue

          return (
            <Card key={metric} className="border border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg capitalize">{metric.replace(/_/g, ' ')}</CardTitle>
                  {trend !== null && (
                    <Badge
                      variant="secondary"
                      className={cn('rounded-full', trend >= 0 ? 'text-success' : 'text-destructive')}
                    >
                      {formatTrend(trend)}
                    </Badge>
                  )}
                </div>
                {latestValue !== null && (
                  <span className="text-3xl font-mono font-bold text-foreground">{latestValue}</span>
                )}
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
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
