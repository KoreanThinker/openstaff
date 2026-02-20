import * as React from 'react'
import { cn } from '@/lib/utils'

type LogoVariant = 'vivid' | 'mono'
type WordmarkVariant = 'gradient' | 'split' | 'mono'

interface OpenStaffLogoProps {
  showWordmark?: boolean
  size?: number
  variant?: LogoVariant
  wordmarkVariant?: WordmarkVariant
  animated?: boolean
  className?: string
  markClassName?: string
  wordmarkClassName?: string
}

function OpenStaffMark({
  size = 28,
  variant = 'vivid',
  animated = false,
  className
}: {
  size?: number
  variant?: LogoVariant
  animated?: boolean
  className?: string
}): React.ReactElement {
  const id = React.useId().replace(/:/g, '')
  const bgGradientId = `openstaff-bg-${id}`
  const loopGradientId = `openstaff-loop-${id}`
  const movingDotFill =
    variant === 'mono' ? 'hsl(var(--foreground))' : 'hsl(var(--background))'
  const dotFill = variant === 'mono' ? 'hsl(var(--foreground))' : 'hsl(var(--background))'
  const loopStroke =
    variant === 'mono' ? 'hsl(var(--foreground))' : `url(#${loopGradientId})`
  const showBadge = variant === 'vivid'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient
          id={bgGradientId}
          x1="6"
          y1="6"
          x2="58"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="hsl(var(--chart-2))" />
          <stop offset="50%" stopColor="hsl(var(--chart-1))" />
          <stop offset="100%" stopColor="hsl(var(--chart-3))" />
        </linearGradient>
        <linearGradient
          id={loopGradientId}
          x1="14"
          y1="32"
          x2="50"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="hsl(var(--background))" stopOpacity="0.95" />
          <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.75" />
        </linearGradient>
      </defs>

      {showBadge && (
        <>
          <rect x="4" y="4" width="56" height="56" rx="18" fill={`url(#${bgGradientId})`} />
          <rect
            x="4.5"
            y="4.5"
            width="55"
            height="55"
            rx="17.5"
            fill="none"
            stroke="hsl(var(--foreground))"
            strokeOpacity="0.09"
          />
        </>
      )}

      <path
        d="M 13 32 C 13 26.4, 17.4 22, 22.8 22 C 30.8 22, 34 42, 41.4 42 C 46.7 42, 51 37.6, 51 32 C 51 26.4, 46.7 22, 41.4 22 C 34 22, 30.8 42, 22.8 42 C 17.4 42, 13 37.6, 13 32 Z"
        fill="none"
        stroke={loopStroke}
        strokeWidth="6"
        strokeLinecap="round"
        strokeOpacity={variant === 'mono' ? 0.95 : 1}
      />

      <circle cx="19" cy="32" r="3.2" fill={dotFill} fillOpacity={variant === 'mono' ? 1 : 0.97} />
      <circle cx="32" cy="22" r="3.2" fill={dotFill} fillOpacity={variant === 'mono' ? 1 : 0.97} />
      <circle cx="45" cy="32" r="3.2" fill={dotFill} fillOpacity={variant === 'mono' ? 1 : 0.97} />

      {animated && (
        <circle r="2.2" fill={movingDotFill}>
          <animateMotion
            dur="6.5s"
            repeatCount="indefinite"
            path="M 19 32 C 19 28, 22 25, 25.8 25 C 29.2 25, 31.3 31.2, 34.5 36 C 36.4 38.8, 38.4 39.8, 40.2 39 C 43.2 37.8, 45 35.3, 45 32 C 45 27.7, 42.2 24.8, 38.8 24.8 C 35.8 24.8, 34.1 27.7, 31.4 31.8 C 28.4 36.2, 26.3 39, 22.8 39 C 19.6 39, 17 36.4, 17 32 C 17 31.6, 17 31.6, 19 32 Z"
          />
        </circle>
      )}
    </svg>
  )
}

export function OpenStaffLogo({
  showWordmark = false,
  size = 28,
  variant = 'vivid',
  wordmarkVariant = 'split',
  animated = false,
  className,
  markClassName,
  wordmarkClassName
}: OpenStaffLogoProps): React.ReactElement {
  const wordmark = (() => {
    if (wordmarkVariant === 'gradient') {
      return (
        <>
          Open
          <span className="bg-gradient-to-r from-[hsl(var(--chart-2))] via-[hsl(var(--chart-1))] to-[hsl(var(--chart-3))] bg-[length:180%_180%] bg-clip-text text-transparent">
            Staff
          </span>
        </>
      )
    }
    if (wordmarkVariant === 'mono') {
      return <>OpenStaff</>
    }
    return (
      <>
        Open
        <span className="text-success">Staff</span>
      </>
    )
  })()
  const wordmarkBaseClass = cn(
    'text-lg leading-none text-foreground',
    wordmarkVariant === 'gradient' && 'font-bold tracking-[-0.024em]',
    wordmarkVariant === 'split' && 'font-semibold tracking-[-0.018em]',
    wordmarkVariant === 'mono' && 'font-medium tracking-[-0.01em] text-foreground/90'
  )

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <OpenStaffMark
        size={size}
        variant={variant}
        animated={animated}
        className={markClassName}
      />
      {showWordmark && (
        <span
          className={cn(
            wordmarkBaseClass,
            wordmarkClassName
          )}
          data-wordmark-variant={wordmarkVariant}
        >
          {wordmark}
        </span>
      )}
    </div>
  )
}
