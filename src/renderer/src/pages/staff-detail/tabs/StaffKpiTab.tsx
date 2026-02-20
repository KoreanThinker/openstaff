import { lazy, Suspense, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Zap } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const StaffKpiCharts = lazy(() =>
  import('./StaffKpiCharts').then((m) => ({ default: m.StaffKpiCharts }))
)

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

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <StaffKpiCharts metricNames={metricNames} kpiData={kpiData} goalValues={goalValues} />
      </Suspense>
    </div>
  )
}
