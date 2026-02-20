import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCost, formatTokens } from '@/lib/utils'

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
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis
                tickFormatter={(v) => formatTokens(v)}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)'
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="input"
                stackId="1"
                fill="hsl(var(--chart-1))"
                stroke="hsl(var(--chart-1))"
                fillOpacity={0.3}
                name="Input"
              />
              <Area
                type="monotone"
                dataKey="output"
                stackId="1"
                fill="hsl(var(--chart-2))"
                stroke="hsl(var(--chart-2))"
                fillOpacity={0.3}
                name="Output"
              />
              <Area
                type="monotone"
                dataKey="cacheRead"
                stackId="1"
                fill="hsl(var(--chart-3))"
                stroke="hsl(var(--chart-3))"
                fillOpacity={0.3}
                name="Cache Read"
              />
              <Area
                type="monotone"
                dataKey="cacheWrite"
                stackId="1"
                fill="hsl(var(--chart-4))"
                stroke="hsl(var(--chart-4))"
                fillOpacity={0.3}
                name="Cache Write"
              />
            </AreaChart>
          </ResponsiveContainer>
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
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis
                tickFormatter={(v) => `$${v}`}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
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
  )
}
