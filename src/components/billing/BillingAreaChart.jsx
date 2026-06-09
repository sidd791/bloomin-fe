import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoneyCompact, formatMoney, formatDate, providerColor } from '@/lib/cost-format'

function BillingTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{formatDate(label)}</p>
      <ul className="space-y-0.5">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums">{formatMoney(entry.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BillingAreaChart({ title, points, loading, height = 300 }) {
  const { chartData, seriesKeys } = useMemo(() => {
    if (!Array.isArray(points) || points.length === 0) return { chartData: [], seriesKeys: [] }

    const keys = [...new Set(points.map((p) => p.key))]
    const byDay = {}
    for (const p of points) {
      if (!byDay[p.day]) byDay[p.day] = { day: p.day }
      byDay[p.day][p.key] = (byDay[p.day][p.key] || 0) + p.cost_usd
    }
    const data = Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day))
    return { chartData: data, seriesKeys: keys }
  }, [points])

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>
          <div className="animate-pulse rounded-md bg-muted/50" style={{ height }} />
        </CardContent>
      </Card>
    )
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
            No data in range.
          </div>
        </CardContent>
      </Card>
    )
  }

  const PROVIDER_NAMES = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google' }

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {seriesKeys.map((k) => (
                  <linearGradient key={k} id={`billing-grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={providerColor(k)} stopOpacity={0.55} />
                    <stop offset="95%" stopColor={providerColor(k)} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.4} strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tickFormatter={formatDate}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatMoneyCompact}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip content={<BillingTooltip />} cursor={{ stroke: 'var(--border)' }} />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                iconType="circle"
                iconSize={8}
                formatter={(value) => PROVIDER_NAMES[value] || value}
              />
              {seriesKeys.map((k) => (
                <Area
                  key={k}
                  type="monotone"
                  dataKey={k}
                  name={k}
                  stackId="1"
                  stroke={providerColor(k)}
                  strokeWidth={2}
                  fill={`url(#billing-grad-${k})`}
                  isAnimationActive
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
