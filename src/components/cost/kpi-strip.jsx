import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function DeltaPill({ delta, invert = false }) {
  if (!delta || delta.direction === 'new') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Minus className="h-3 w-3" /> no prior data
      </span>
    )
  }
  if (delta.pct === null || delta.pct === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Minus className="h-3 w-3" /> no change
      </span>
    )
  }
  const dir = delta.direction
  let color = 'text-muted-foreground'
  let Icon = Minus
  if (dir === 'up') {
    Icon = TrendingUp
    color = invert ? 'text-red-500' : 'text-emerald-500'
  } else if (dir === 'down') {
    Icon = TrendingDown
    color = invert ? 'text-emerald-500' : 'text-red-500'
  }
  const sign = delta.pct > 0 ? '+' : ''
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', color)}>
      <Icon className="h-3 w-3" />
      {sign}
      {delta.pct.toFixed(1)}%
      <span className="font-normal text-muted-foreground">vs prior period</span>
    </span>
  )
}

export function KpiCard({ label, value, sublabel, delta, deltaInvert = false, loading }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {loading ? (
          <div className="mt-2 h-7 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          {sublabel ? (
            <span className="text-[11px] text-muted-foreground truncate">{sublabel}</span>
          ) : (
            <span />
          )}
          <DeltaPill delta={delta} invert={deltaInvert} />
        </div>
      </CardContent>
    </Card>
  )
}

export function KpiStrip({ children }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  )
}

export function StatCard({ icon: Icon, label, value, sublabel, loading }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-sm font-semibold truncate">{value}</p>
          )}
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          {sublabel && (
            <p className="text-[10px] text-muted-foreground/70 truncate">{sublabel}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function StatStrip({ children }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
  )
}
