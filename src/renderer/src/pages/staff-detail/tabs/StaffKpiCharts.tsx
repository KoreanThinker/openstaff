import { cn, formatTrend } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { KpiEntry } from '@shared/types'
import { SimpleLineChart } from '@/components/charts/SimpleCharts'

export function StaffKpiCharts({
  metricNames,
  kpiData,
  goalValues
}: {
  metricNames: string[]
  kpiData: KpiEntry[]
  goalValues: Record<string, number>
}): React.ReactElement {
  return (
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
              <SimpleLineChart
                data={chartData}
                valueKey="value"
                lineColorVar={isMeetingGoal ? '--chart-1' : '--chart-5'}
                goalValue={goalValue}
              />
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
