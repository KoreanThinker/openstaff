import { useMemo } from 'react'
import { cn } from '@/lib/utils'

const CHART_WIDTH = 640
const CHART_HEIGHT = 220
const PAD_X = 38
const PAD_Y = 16

function shortDate(date: string): string {
  if (date.length >= 10) return date.slice(5)
  return date
}

type BasePoint = {
  date: string
}

type SeriesConfig<T extends BasePoint> = {
  key: keyof T
  label: string
  colorVar: string
}

function toHsl(varName: string): string {
  return `hsl(var(${varName}))`
}

export function SimpleStackedAreaChart<T extends BasePoint>({
  data,
  series,
  className
}: {
  data: T[]
  series: SeriesConfig<T>[]
  className?: string
}): React.ReactElement {
  const points = useMemo(() => data, [data])
  const innerW = CHART_WIDTH - PAD_X * 2
  const innerH = CHART_HEIGHT - PAD_Y * 2
  const maxTotal = Math.max(
    1,
    ...points.map((point) =>
      series.reduce((sum, item) => sum + Number(point[item.key] ?? 0), 0)
    )
  )
  const len = points.length
  const xForIndex = (index: number): number =>
    PAD_X + (len <= 1 ? innerW / 2 : (index / (len - 1)) * innerW)
  const yForValue = (value: number): number => PAD_Y + ((maxTotal - value) / maxTotal) * innerH

  const layeredPaths = useMemo(() => {
    const cumulative = new Array(len).fill(0)
    return series.map((item) => {
      const upper = points.map((point, index) => {
        cumulative[index] += Number(point[item.key] ?? 0)
        return { x: xForIndex(index), y: yForValue(cumulative[index]) }
      })
      const lower = points.map((_, index) => ({ x: xForIndex(index), y: yForValue(cumulative[index] - Number(points[index][item.key] ?? 0)) }))
      const path = [
        `M ${upper[0]?.x ?? PAD_X} ${upper[0]?.y ?? PAD_Y}`,
        ...upper.slice(1).map((p) => `L ${p.x} ${p.y}`),
        ...lower.reverse().map((p) => `L ${p.x} ${p.y}`),
        'Z'
      ].join(' ')
      return { key: String(item.key), label: item.label, color: toHsl(item.colorVar), path }
    })
  }, [len, points, series])

  if (points.length === 0) {
    return <div className={cn('h-[220px] rounded-lg bg-muted/50', className)} />
  }

  return (
    <div className={cn('space-y-2', className)}>
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-[220px] w-full" role="img">
        <rect x={PAD_X} y={PAD_Y} width={innerW} height={innerH} fill="hsl(var(--muted)/0.35)" rx={6} />
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={PAD_X}
            y1={PAD_Y + innerH * ratio}
            x2={PAD_X + innerW}
            y2={PAD_Y + innerH * ratio}
            stroke="hsl(var(--border))"
            strokeDasharray="3 4"
            strokeWidth="1"
          />
        ))}
        {layeredPaths.map((layer) => (
          <path key={layer.key} d={layer.path} fill={layer.color} fillOpacity={0.22} stroke={layer.color} strokeWidth={1.2} />
        ))}
        <text x={PAD_X} y={CHART_HEIGHT - 2} className="fill-muted-foreground text-[10px]">{shortDate(points[0].date)}</text>
        <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 2} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {shortDate(points[Math.floor(points.length / 2)].date)}
        </text>
        <text x={PAD_X + innerW} y={CHART_HEIGHT - 2} textAnchor="end" className="fill-muted-foreground text-[10px]">
          {shortDate(points[points.length - 1].date)}
        </text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {series.map((item) => (
          <span key={String(item.key)} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: toHsl(item.colorVar) }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function SimpleBarChart<T extends BasePoint>({
  data,
  valueKey,
  colorVar,
  className
}: {
  data: T[]
  valueKey: keyof T
  colorVar: string
  className?: string
}): React.ReactElement {
  const points = useMemo(() => data, [data])
  const innerW = CHART_WIDTH - PAD_X * 2
  const innerH = CHART_HEIGHT - PAD_Y * 2
  const maxValue = Math.max(1, ...points.map((point) => Number(point[valueKey] ?? 0)))
  const step = points.length === 0 ? innerW : innerW / points.length
  const barW = Math.max(6, step * 0.64)

  if (points.length === 0) {
    return <div className={cn('h-[220px] rounded-lg bg-muted/50', className)} />
  }

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className={cn('h-[220px] w-full', className)} role="img">
      <rect x={PAD_X} y={PAD_Y} width={innerW} height={innerH} fill="hsl(var(--muted)/0.35)" rx={6} />
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={ratio}
          x1={PAD_X}
          y1={PAD_Y + innerH * ratio}
          x2={PAD_X + innerW}
          y2={PAD_Y + innerH * ratio}
          stroke="hsl(var(--border))"
          strokeDasharray="3 4"
          strokeWidth="1"
        />
      ))}
      {points.map((point, index) => {
        const value = Number(point[valueKey] ?? 0)
        const height = (value / maxValue) * innerH
        const x = PAD_X + step * index + (step - barW) / 2
        const y = PAD_Y + innerH - height
        return <rect key={`${point.date}-${index}`} x={x} y={y} width={barW} height={height} rx={4} fill={toHsl(colorVar)} />
      })}
      <text x={PAD_X} y={CHART_HEIGHT - 2} className="fill-muted-foreground text-[10px]">{shortDate(points[0].date)}</text>
      <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 2} textAnchor="middle" className="fill-muted-foreground text-[10px]">
        {shortDate(points[Math.floor(points.length / 2)].date)}
      </text>
      <text x={PAD_X + innerW} y={CHART_HEIGHT - 2} textAnchor="end" className="fill-muted-foreground text-[10px]">
        {shortDate(points[points.length - 1].date)}
      </text>
    </svg>
  )
}

export function SimpleLineChart<T extends BasePoint>({
  data,
  valueKey,
  lineColorVar,
  goalValue,
  className
}: {
  data: T[]
  valueKey: keyof T
  lineColorVar: string
  goalValue?: number
  className?: string
}): React.ReactElement {
  const points = useMemo(() => data, [data])
  const innerW = CHART_WIDTH - PAD_X * 2
  const innerH = CHART_HEIGHT - PAD_Y * 2
  const values = points.map((point) => Number(point[valueKey] ?? 0))
  const maxValue = Math.max(1, ...values, goalValue ?? 0)
  const minValue = Math.min(0, ...values, goalValue ?? 0)
  const range = Math.max(1, maxValue - minValue)
  const xForIndex = (index: number): number =>
    PAD_X + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW)
  const yForValue = (value: number): number => PAD_Y + ((maxValue - value) / range) * innerH

  const linePath = values
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${xForIndex(index)} ${yForValue(value)}`)
    .join(' ')

  if (points.length === 0) {
    return <div className={cn('h-[220px] rounded-lg bg-muted/50', className)} />
  }

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className={cn('h-[220px] w-full', className)} role="img">
      <rect x={PAD_X} y={PAD_Y} width={innerW} height={innerH} fill="hsl(var(--muted)/0.35)" rx={6} />
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={ratio}
          x1={PAD_X}
          y1={PAD_Y + innerH * ratio}
          x2={PAD_X + innerW}
          y2={PAD_Y + innerH * ratio}
          stroke="hsl(var(--border))"
          strokeDasharray="3 4"
          strokeWidth="1"
        />
      ))}
      {goalValue !== undefined && (
        <line
          x1={PAD_X}
          y1={yForValue(goalValue)}
          x2={PAD_X + innerW}
          y2={yForValue(goalValue)}
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="6 6"
          strokeWidth="1.1"
          opacity={0.75}
        />
      )}
      <path d={linePath} fill="none" stroke={toHsl(lineColorVar)} strokeWidth={2} />
      {values.map((value, index) => (
        <circle
          key={`${points[index].date}-${index}`}
          cx={xForIndex(index)}
          cy={yForValue(value)}
          r={2.8}
          fill={toHsl(lineColorVar)}
        />
      ))}
      <text x={PAD_X} y={CHART_HEIGHT - 2} className="fill-muted-foreground text-[10px]">{shortDate(points[0].date)}</text>
      <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 2} textAnchor="middle" className="fill-muted-foreground text-[10px]">
        {shortDate(points[Math.floor(points.length / 2)].date)}
      </text>
      <text x={PAD_X + innerW} y={CHART_HEIGHT - 2} textAnchor="end" className="fill-muted-foreground text-[10px]">
        {shortDate(points[points.length - 1].date)}
      </text>
    </svg>
  )
}
