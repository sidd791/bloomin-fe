import React, { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, AlertOctagon, ShieldQuestion } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CostService } from '@/services/cost.service'
import { formatPercent } from '@/lib/cost-format'

export function ReconBadge() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    CostService.getReconciliation({ days: 1 })
      .then((data) => {
        if (alive) setRows(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (alive) setError(err)
      })
    return () => {
      alive = false
    }
  }, [])

  if (error) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 py-3">
          <ShieldQuestion className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Reconciliation unavailable</p>
            <p className="text-xs text-muted-foreground">
              {error.status === 403
                ? 'Admin-only metric.'
                : 'Could not load drift data.'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (rows === null) {
    return (
      <Card>
        <CardContent className="py-3">
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-3">
          <ShieldQuestion className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">No reconciliation data yet</p>
            <p className="text-xs text-muted-foreground">
              Provider hasn't reported usage for this period yet.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxDrift = rows.reduce(
    (acc, r) => Math.max(acc, Math.abs(Number(r.drift_pct) || 0)),
    0,
  )
  let tone = 'success'
  if (maxDrift > 2) tone = 'destructive'
  else if (maxDrift > 0.5) tone = 'warning'

  const palette = {
    success: {
      Icon: CheckCircle2,
      bar: 'bg-emerald-500',
      tint: 'bg-emerald-500/5 border-emerald-500/20',
      text: 'text-emerald-700 dark:text-emerald-300',
      label: 'All providers in sync',
    },
    warning: {
      Icon: AlertTriangle,
      bar: 'bg-amber-500',
      tint: 'bg-amber-500/5 border-amber-500/20',
      text: 'text-amber-700 dark:text-amber-300',
      label: 'Minor drift detected',
    },
    destructive: {
      Icon: AlertOctagon,
      bar: 'bg-red-500',
      tint: 'bg-red-500/5 border-red-500/20',
      text: 'text-red-700 dark:text-red-300',
      label: 'Drift exceeds 2% — pricing table likely stale',
    },
  }[tone]

  const { Icon } = palette

  return (
    <Card className={palette.tint}>
      <CardContent className="flex items-center gap-3 py-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${palette.bar}/10`}>
          <Icon className={`h-4 w-4 ${palette.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${palette.text}`}>{palette.label}</p>
          <p className="text-xs text-muted-foreground">
            Max drift in last 24h: {formatPercent(maxDrift, 2)} ·{' '}
            {rows.length} reconciled {rows.length === 1 ? 'row' : 'rows'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
