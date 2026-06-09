import React, { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import { CostShell } from '@/components/cost/cost-shell'
import { CostFilters } from '@/components/cost/cost-filters'
import { useCostFilters } from '@/components/cost/use-cost-filters'
import { useCostData } from '@/components/cost/use-cost-data'
import { KpiStrip, KpiCard } from '@/components/cost/kpi-strip'
import { CostAreaChart, CostBarChart } from '@/components/cost/charts'
import { SessionsTable } from '@/components/cost/sessions-table'
import { EventsTable } from '@/components/cost/events-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CostService } from '@/services/cost.service'
import { useAuth } from '@/contexts/auth-context'
import {
  computeDelta,
  formatMoney,
  formatRatio,
  priorRangeParams,
  filterChatModels,
} from '@/lib/cost-format'

function pivotTimeseries(points) {
  if (!Array.isArray(points)) return { rows: [], keys: [] }
  const byBucket = new Map()
  const keys = new Set()
  points.forEach((p) => {
    const bucket = p.bucket
    if (!byBucket.has(bucket)) byBucket.set(bucket, { bucket, day: bucket })
    const row = byBucket.get(bucket)
    if (p.key) {
      row[p.key] = (row[p.key] || 0) + (Number(p.cost) || 0)
      keys.add(p.key)
    } else {
      row.cost = (row.cost || 0) + (Number(p.cost) || 0)
    }
  })
  const rows = Array.from(byBucket.values()).sort((a, b) =>
    String(a.bucket).localeCompare(String(b.bucket)),
  )
  return { rows, keys: Array.from(keys) }
}

export function CostUserPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user: me, loading: authLoading } = useAuth()

  const { filters, setFilters, toggleInArray, clearAll, apiParams } =
    useCostFilters()
  const paramsKey = useMemo(() => JSON.stringify(apiParams), [apiParams])

  const isAdmin = !!me?.is_admin

  const { data: summary, loading: summaryLoading, error: summaryError } = useCostData(
    () => CostService.getUserSummary(userId, apiParams),
    [userId, paramsKey],
  )

  const { data: priorSummary } = useCostData(
    () => {
      if (!summary) return Promise.resolve(null)
      const prior = priorRangeParams(
        filters.range,
        summary.range_from,
        summary.range_to,
      )
      return CostService.getUserSummary(userId, { ...apiParams, ...prior }).catch(
        () => null,
      )
    },
    [summary, filters.range, userId, paramsKey],
  )

  const { data: leaderboard } = useCostData(
    () => (isAdmin ? CostService.getUsers({ range: '30d' }) : Promise.resolve([])),
    [isAdmin],
  )
  const userMeta = (leaderboard || []).find((u) => u.user_id === userId) || null

  const granularity = filters.range === '24h' ? 'hour' : 'day'
  const { data: timeseries, loading: tsLoading } = useCostData(
    () =>
      CostService.getTimeseries({
        ...apiParams,
        granularity,
        group_by: 'model',
        user_id: userId,
      }),
    [userId, paramsKey, granularity],
  )

  const { data: sessions, loading: sessionsLoading } = useCostData(
    () => CostService.getUserSessions(userId, { ...apiParams, limit: 20 }),
    [userId, paramsKey],
  )

  const { data: events, loading: eventsLoading } = useCostData(
    () => CostService.getEvents({ ...apiParams, user_id: userId, limit: 50 }),
    [userId, paramsKey],
  )

  if (authLoading) {
    return <CostShell><div className="p-5 text-sm text-muted-foreground">Loading...</div></CostShell>
  }

  if (!isAdmin) {
    return (
      <CostShell>
        <div className="mx-auto max-w-2xl px-5 py-10 text-center">
          <h1 className="text-xl font-semibold">Admin only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The per-user dashboard is only available to administrators.
          </p>
          <Button className="mt-4" onClick={() => navigate('/cost')}>
            Back to dashboard
          </Button>
        </div>
      </CostShell>
    )
  }

  const totalCostDelta = computeDelta(
    summary?.total_cost,
    priorSummary?.total_cost,
  )
  const turnsDelta = computeDelta(summary?.turn_count, priorSummary?.turn_count)
  const avgCostDelta = computeDelta(
    summary?.avg_cost_per_turn,
    priorSummary?.avg_cost_per_turn,
  )
  const cacheRatio =
    summary && summary.total_input_tokens > 0
      ? summary.total_cached_tokens / summary.total_input_tokens
      : null

  const { rows: tsRows, keys: tsKeys } = useMemo(
    () => pivotTimeseries(timeseries),
    [timeseries],
  )

  return (
    <CostShell>
      <CostFilters
        filters={filters}
        setFilters={setFilters}
        toggleInArray={toggleInArray}
        clearAll={clearAll}
      />

      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-6">
        {/* User header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate('/cost')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {userMeta?.name || 'User'}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {userMeta?.email ? (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {userMeta.email}
                </span>
              ) : (
                <span>{userId}</span>
              )}
            </div>
          </div>
        </div>

        {summaryError && summaryError.status === 404 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No activity recorded for this user.
            </CardContent>
          </Card>
        ) : null}

        {/* KPI cards */}
        <KpiStrip>
          <KpiCard
            label="Total spend"
            value={formatMoney(summary?.total_cost ?? 0)}
            sublabel={`${(summary?.request_count ?? 0).toLocaleString()} AI requests`}
            delta={totalCostDelta}
            deltaInvert
            loading={summaryLoading}
          />
          <KpiCard
            label="Messages"
            value={(summary?.turn_count ?? 0).toLocaleString()}
            sublabel="Conversations with AI"
            delta={turnsDelta}
            loading={summaryLoading}
          />
          <KpiCard
            label="Avg per message"
            value={formatMoney(summary?.avg_cost_per_turn ?? 0)}
            sublabel="Average cost per conversation"
            delta={avgCostDelta}
            deltaInvert
            loading={summaryLoading}
          />
          <KpiCard
            label="Savings rate"
            value={formatRatio(cacheRatio)}
            sublabel="Saved by reusing cached responses"
            loading={summaryLoading}
          />
        </KpiStrip>

        {/* Big spending over time chart (by model) */}
        <CostAreaChart
          title="Spending over time (by model)"
          data={tsRows}
          seriesKeys={tsKeys.length ? tsKeys : undefined}
          height={360}
          loading={tsLoading}
        />

        {/* Model breakdown — excludes embedding/system models */}
        <CostBarChart
          title="Spending by AI model"
          rows={filterChatModels(summary?.by_model)}
          loading={summaryLoading}
          height={Math.max(180, (filterChatModels(summary?.by_model)?.length || 3) * 50 + 40)}
          context="model"
          onBarClick={(key) => {
            if (key) toggleInArray('model', key)
          }}
        />

        {/* Most expensive conversations */}
        <SessionsTable
          sessions={sessions}
          loading={sessionsLoading}
        />

        {/* Recent activity */}
        <EventsTable
          title="Recent activity"
          events={events}
          loading={eventsLoading}
          showUser={false}
          emptyHint="No activity recorded for this user."
        />
      </div>
    </CostShell>
  )
}
