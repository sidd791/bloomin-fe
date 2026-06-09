import React, { useMemo, useState, useCallback } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoneyCompact, colorForKey } from '@/lib/cost-format'

function DonutCenter({ total, activeSlice }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      {activeSlice ? (
        <>
          <span className="max-w-[90px] truncate text-[10px] font-medium text-muted-foreground">
            {activeSlice.name}
          </span>
          <span className="text-lg font-semibold tabular-nums">
            {formatMoneyCompact(activeSlice.value)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {activeSlice.pct}%
          </span>
        </>
      ) : (
        <>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </span>
          <span className="text-lg font-semibold tabular-nums">
            {formatMoneyCompact(total)}
          </span>
        </>
      )}
    </div>
  )
}

export function BillingDonutChart({
  title,
  data,
  loading,
  emptyHint = 'No data.',
  colorFn,
  maxSlices,
}) {
  const { slices, total } = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return { slices: [], total: 0 }

    const sorted = [...data].sort((a, b) => b.value - a.value)
    const total = sorted.reduce((s, d) => s + d.value, 0)

    if (maxSlices && sorted.length > maxSlices) {
      const top = sorted.slice(0, maxSlices)
      const otherValue = sorted.slice(maxSlices).reduce((s, d) => s + d.value, 0)
      if (otherValue > 0) {
        top.push({ name: 'Other', value: otherValue })
      }
      return { slices: top, total }
    }
    return { slices: sorted, total }
  }, [data, maxSlices])

  const [activeIndex, setActiveIndex] = useState(null)

  const activeSlice = useMemo(() => {
    if (activeIndex == null || !slices[activeIndex]) return null
    const s = slices[activeIndex]
    const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : '0.0'
    return { name: s.name, value: s.value, pct }
  }, [activeIndex, slices, total])

  const onPieEnter = useCallback((_, index) => setActiveIndex(index), [])
  const onPieLeave = useCallback(() => setActiveIndex(null), [])

  const getColor = colorFn || ((name, idx) => colorForKey(name, idx))

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[220px] animate-pulse rounded-md bg-muted/50" />
        </CardContent>
      </Card>
    )
  }

  if (slices.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            {emptyHint}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <div>
          <div className="relative" style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={86}
                  paddingAngle={1}
                  isAnimationActive
                  onMouseEnter={onPieEnter}
                  onMouseLeave={onPieLeave}
                >
                  {slices.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={getColor(entry.name, idx)}
                      stroke="var(--background)"
                      strokeWidth={1.5}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <DonutCenter total={total} activeSlice={activeSlice} />
          </div>
          <ul className="mt-2 space-y-1">
            {slices.map((row, idx) => (
              <li key={row.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: getColor(row.name, idx) }}
                  />
                  <span className="truncate text-muted-foreground">{row.name}</span>
                </span>
                <span className="font-medium tabular-nums">{formatMoneyCompact(row.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
