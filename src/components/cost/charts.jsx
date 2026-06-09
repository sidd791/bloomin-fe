import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CHART_PALETTE,
  colorForKey,
  formatMoneyCompact,
  formatMoney,
  formatDate,
  friendlyChannel,
  friendlyMode,
} from '@/lib/cost-format'

function friendlyKey(key, context) {
  if (!key) return 'Other';
  if (context === 'channel') return friendlyChannel(key);
  if (context === 'mode') return friendlyMode(key);
  const slash = key.indexOf('/');
  if (slash >= 0) return key.slice(slash + 1);
  return key;
}

function CostTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">
        {labelFormatter ? labelFormatter(label) : label}
      </p>
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
            <span className="font-medium tabular-nums">
              {formatMoney(entry.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Stacked area chart of cost over time.
 *
 * Two modes:
 *   - byDay: pass `data` = Summary.by_day -> single series ("cost").
 *   - grouped: pass `data` = list of points already pivoted by `key`,
 *              and `seriesKeys` = ordered list of keys for the stacks.
 */
export function CostAreaChart({ title, data, seriesKeys, height = 260, loading }) {
  const chartData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return []
    return data.map((d) => ({ ...d, _label: d.day || d.bucket }))
  }, [data])

  if (loading) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="h-[260px] animate-pulse rounded-md bg-muted/50" />
        </CardContent>
      </Card>
    )
  }

  if (chartData.length === 0) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            No data in range.
          </div>
        </CardContent>
      </Card>
    )
  }

  const keys =
    seriesKeys && seriesKeys.length > 0 ? seriesKeys : ['cost']

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {keys.map((k, idx) => (
                  <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={colorForKey(k, idx)}
                      stopOpacity={0.55}
                    />
                    <stop
                      offset="95%"
                      stopColor={colorForKey(k, idx)}
                      stopOpacity={0}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.4} strokeDasharray="3 3" />
              <XAxis
                dataKey="_label"
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
              <Tooltip
                content={<CostTooltip labelFormatter={formatDate} />}
                cursor={{ stroke: 'var(--border)' }}
              />
              {keys.length > 1 && (
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="circle"
                  iconSize={8}
                />
              )}
              {keys.map((k, idx) => (
                <Area
                  key={k}
                  type="monotone"
                  dataKey={k}
                  name={k}
                  stackId={keys.length > 1 ? '1' : undefined}
                  stroke={colorForKey(k, idx)}
                  strokeWidth={2}
                  fill={`url(#grad-${k})`}
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

function DonutCenter({ totalCost }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Total
      </span>
      <span className="text-lg font-semibold tabular-nums">
        {formatMoneyCompact(totalCost)}
      </span>
    </div>
  )
}

export function CostDonutChart({
  title,
  rows,
  onSliceClick,
  emptyHint = 'No spend yet.',
  loading,
  context,
}) {
  const sorted = useMemo(() => {
    return [...(rows || [])].sort((a, b) => Number(b.cost) - Number(a.cost))
  }, [rows])

  const totalCost = sorted.reduce((acc, r) => acc + (Number(r.cost) || 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[220px] animate-pulse rounded-md bg-muted/50" />
        ) : sorted.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            {emptyHint}
          </div>
        ) : (
          <div className="relative">
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={sorted}
                    dataKey="cost"
                    nameKey="key"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={86}
                    paddingAngle={1}
                    onClick={(entry) => onSliceClick?.(entry?.key)}
                    isAnimationActive
                  >
                    {sorted.map((entry, idx) => (
                      <Cell
                        key={entry.key}
                        fill={colorForKey(entry.key, idx)}
                        stroke="var(--background)"
                        strokeWidth={1.5}
                        style={{ cursor: onSliceClick ? 'pointer' : 'default' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0]
                      return (
                        <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                          <p className="font-medium">{friendlyKey(p.payload.key, context)}</p>
                          <p className="text-muted-foreground">
                            {formatMoney(p.payload.cost)} · {p.payload.requests}{' '}
                            {p.payload.requests === 1 ? 'request' : 'requests'}
                          </p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <DonutCenter totalCost={totalCost} />
            </div>
            <ul className="mt-2 space-y-1">
              {sorted.slice(0, 5).map((row, idx) => (
                <li
                  key={row.key}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => onSliceClick?.(row.key)}
                    className="flex min-w-0 items-center gap-1.5 truncate text-left hover:text-foreground"
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: colorForKey(row.key, idx) }}
                    />
                    <span className="truncate text-muted-foreground">
                      {friendlyKey(row.key, context)}
                    </span>
                  </button>
                  <span className="font-medium tabular-nums">
                    {formatMoneyCompact(row.cost)}
                  </span>
                </li>
              ))}
              {sorted.length > 5 && (
                <li className="text-[11px] text-muted-foreground">
                  + {sorted.length - 5} more
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function CostBarChart({ title, rows, onBarClick, height = 220, loading, context }) {
  const sorted = useMemo(
    () => [...(rows || [])].sort((a, b) => Number(b.cost) - Number(a.cost)),
    [rows],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div
            className="animate-pulse rounded-md bg-muted/50"
            style={{ height }}
          />
        ) : sorted.length === 0 ? (
          <div
            className="flex items-center justify-center text-sm text-muted-foreground"
            style={{ height }}
          >
            No data.
          </div>
        ) : (
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
                  dataKey="key"
                  tickFormatter={(v) => friendlyKey(v, context)}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  width={100}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0]
                    return (
                      <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                        <p className="font-medium">{friendlyKey(p.payload.key, context)}</p>
                        <p className="text-muted-foreground">
                          {formatMoney(p.payload.cost)} · {p.payload.requests}{' '}
                          {p.payload.requests === 1 ? 'request' : 'requests'}
                        </p>
                      </div>
                    )
                  }}
                  cursor={{ fill: 'var(--muted)', fillOpacity: 0.3 }}
                />
                <Bar
                  dataKey="cost"
                  radius={[0, 4, 4, 0]}
                  onClick={(entry) => onBarClick?.(entry?.payload?.key)}
                >
                  {sorted.map((entry, idx) => (
                    <Cell
                      key={entry.key}
                      fill={colorForKey(entry.key, idx)}
                      style={{ cursor: onBarClick ? 'pointer' : 'default' }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { CHART_PALETTE }
