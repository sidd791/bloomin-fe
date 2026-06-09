import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney, formatMoneyCompact, colorForKey } from '@/lib/cost-format'

export function BillingBarChart({ title, data, loading, height = 300, max = 10 }) {
  const sorted = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return []
    return [...data].sort((a, b) => b.value - a.value).slice(0, max)
  }, [data, max])

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

  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
            No data.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer>
            <BarChart
              data={sorted}
              layout="vertical"
              margin={{ top: 5, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                stroke="var(--border)"
                strokeOpacity={0.4}
                strokeDasharray="3 3"
                horizontal={false}
              />
              <XAxis
                type="number"
                tickFormatter={formatMoneyCompact}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                width={120}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0]
                  return (
                    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                      <p className="font-medium">{p.payload.name}</p>
                      <p className="text-muted-foreground">{formatMoney(p.value)}</p>
                    </div>
                  )
                }}
                cursor={{ fill: 'var(--muted)', fillOpacity: 0.3 }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {sorted.map((entry, idx) => (
                  <Cell
                    key={entry.name}
                    fill={colorForKey(entry.name, idx)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
