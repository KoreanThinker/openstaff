import { lazy, Suspense, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatCost, formatTokens } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

type TimeRange = '24h' | '7d' | '30d' | 'all'

const StaffMetricsCharts = lazy(() =>
  import('./StaffMetricsCharts').then((m) => ({ default: m.StaffMetricsCharts }))
)

export function StaffMetricsTab({ staffId }: { staffId: string }): React.ReactElement {
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
      all: Infinity
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
          <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="mb-1 text-sm font-medium text-foreground">No metrics yet</p>
          <p className="max-w-xs text-center text-sm text-muted-foreground">
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
      <div className="w-fit rounded-full bg-muted p-1">
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

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <StaffMetricsCharts chartData={chartData} totalCost={totals.cost} />
      </Suspense>

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
              {
                label: 'Input Tokens',
                value:
                  totals.cost > 0
                    ? (totals.input /
                        ((totals.input + totals.output + totals.cacheRead + totals.cacheWrite) || 1)) *
                      totals.cost
                    : 0,
                color: 'bg-chart-1'
              },
              {
                label: 'Output Tokens',
                value:
                  totals.cost > 0
                    ? (totals.output /
                        ((totals.input + totals.output + totals.cacheRead + totals.cacheWrite) || 1)) *
                      totals.cost
                    : 0,
                color: 'bg-chart-2'
              },
              {
                label: 'Cache Read',
                value:
                  totals.cost > 0
                    ? (totals.cacheRead /
                        ((totals.input + totals.output + totals.cacheRead + totals.cacheWrite) || 1)) *
                      totals.cost
                    : 0,
                color: 'bg-chart-3'
              },
              {
                label: 'Cache Write',
                value:
                  totals.cost > 0
                    ? (totals.cacheWrite /
                        ((totals.input + totals.output + totals.cacheRead + totals.cacheWrite) || 1)) *
                      totals.cost
                    : 0,
                color: 'bg-chart-4'
              }
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
              <span className="font-mono text-sm font-semibold text-foreground">
                {formatCost(totals.cost)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
