import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCost } from '@/lib/utils'
import { SimpleBarChart, SimpleStackedAreaChart } from '@/components/charts/SimpleCharts'

type MetricsChartData = {
  date: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  cost: number
}

export function StaffMetricsCharts({
  chartData,
  totalCost
}: {
  chartData: MetricsChartData[]
  totalCost: number
}): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-lg">Token Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleStackedAreaChart
            data={chartData}
            series={[
              { key: 'input', label: 'Input', colorVar: '--chart-1' },
              { key: 'output', label: 'Output', colorVar: '--chart-2' },
              { key: 'cacheRead', label: 'Cache Read', colorVar: '--chart-3' },
              { key: 'cacheWrite', label: 'Cache Write', colorVar: '--chart-4' }
            ]}
          />
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Cost</CardTitle>
            <Badge variant="secondary" className="rounded-full font-mono">
              Total: {formatCost(totalCost)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <SimpleBarChart data={chartData} valueKey="cost" colorVar="--chart-1" />
        </CardContent>
      </Card>
    </div>
  )
}
