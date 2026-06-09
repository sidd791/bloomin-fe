import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney, formatMoneyCompact, heatColor } from '@/lib/cost-format'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

/**
 * Hourly heatmap. Expects `points`: TimeseriesPoint[] with hourly granularity.
 * Bucket strings are ISO datetimes — we extract weekday + hour from them.
 */
export function CostHeatmap({ title = 'Hourly heatmap', points, loading }) {
  const [hover, setHover] = useState(null)

  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0))
    if (!Array.isArray(points)) return { grid: g, max: 0 }
    let max = 0
    points.forEach((p) => {
      const d = new Date(p.bucket)
      if (Number.isNaN(d.getTime())) return
      // JS: 0=Sun..6=Sat. Convert to Mon=0..Sun=6
      const dow = (d.getUTCDay() + 6) % 7
      const hour = d.getUTCHours()
      const c = Number(p.cost) || 0
      g[dow][hour] += c
      if (g[dow][hour] > max) max = g[dow][hour]
    })
    return { grid: g, max }
  }, [points])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] animate-pulse rounded-md bg-muted/50" />
        </CardContent>
      </Card>
    )
  }

  const hasData = grid.max > 0
  const max = grid.max || 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No hourly activity yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="inline-grid gap-px text-[10px] text-muted-foreground"
              style={{ gridTemplateColumns: 'auto repeat(24, minmax(14px, 1fr))' }}
            >
              <div />
              {HOURS.map((h) => (
                <div
                  key={`h-${h}`}
                  className={`text-center ${h % 3 === 0 ? '' : 'opacity-30'}`}
                >
                  {h % 3 === 0 ? h : ''}
                </div>
              ))}

              {DAYS.map((day, di) => (
                <React.Fragment key={day}>
                  <div className="pr-2 text-right">{day}</div>
                  {HOURS.map((h) => {
                    const v = grid.grid[di][h]
                    const ratio = v / max
                    return (
                      <div
                        key={`${di}-${h}`}
                        role="img"
                        aria-label={`${day} ${h}:00 — ${formatMoney(v)}`}
                        onMouseEnter={() => setHover({ day, hour: h, value: v })}
                        onMouseLeave={() => setHover(null)}
                        className="aspect-square rounded-[3px] transition-transform hover:scale-110 hover:ring-2 hover:ring-primary/40"
                        style={{ background: heatColor(ratio) }}
                      />
                    )
                  })}
                </React.Fragment>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Less</span>
                <div className="flex h-2 w-24 overflow-hidden rounded">
                  {[0.05, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
                    <div
                      key={v}
                      className="flex-1"
                      style={{ background: heatColor(v) }}
                    />
                  ))}
                </div>
                <span>More</span>
              </div>
              <span className="tabular-nums">
                {hover
                  ? `${hover.day} ${hover.hour.toString().padStart(2, '0')}:00 · ${formatMoney(hover.value)}`
                  : `Peak: ${formatMoneyCompact(grid.max)}/hr`}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
