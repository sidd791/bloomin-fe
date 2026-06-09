import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Crown,
  Users,
  Cpu,
  Eye,
  EyeOff,
} from 'lucide-react'
import { CostShell } from '@/components/cost/cost-shell'
import { CostFilters } from '@/components/cost/cost-filters'
import { useCostFilters } from '@/components/cost/use-cost-filters'
import { useCostData } from '@/components/cost/use-cost-data'
import {
  KpiStrip,
  KpiCard,
  StatStrip,
  StatCard,
} from '@/components/cost/kpi-strip'
import { CostAreaChart, CostDonutChart } from '@/components/cost/charts'
import { UserSpendChart } from '@/components/cost/user-spend-chart'

import { CostService } from '@/services/cost.service'
import { useAuth } from '@/contexts/auth-context'
import {
  computeDelta,
  formatMoney,
  formatMoneyCompact,
  formatRatio,
  priorRangeParams,
  filterChatModels,
  isSystemUser,
  modelLabel,
} from '@/lib/cost-format'
import { Button } from '@/components/ui/button'

function generateMockData() {
  const names = [
    'Aisha Patel', 'Marco Rossi', 'Yuki Tanaka', 'Elena Voronova',
    'James O\'Brien', 'Priya Sharma', 'Carlos Mendoza', 'Sofia Andersson',
    'Raj Krishnan', 'Olivia Chen', 'Hassan Al-Farsi', 'Mia Johnson',
    'Liam Park', 'Fatima Nouri', 'David Kim', 'Nina Petrova',
    'Alex Thompson', 'Zara Ahmed', 'Ben Williams', 'Chloe Martin',
  ]
  const models = [
    'anthropic/claude-opus-4', 'openai/gpt-5.4', 'anthropic/claude-sonnet-4',
    'google/gemini-3-pro', 'openai/gpt-4.1',
  ]
  const emails = names.map(
    (n) => n.toLowerCase().replace(/[' ]/g, '.').replace('..', '.') + '@company.com',
  )

  const mockUsers = names.map((name, i) => {
    const cost = Math.max(0.5, 180 - i * 8.5 + Math.random() * 15)
    return {
      user_id: `usr_${String(i + 1).padStart(3, '0')}`,
      name,
      email: emails[i],
      cost: cost.toFixed(4),
      turns: Math.floor(40 + Math.random() * 800),
      top_model: models[Math.floor(Math.random() * models.length)],
    }
  })

  const mockSummary = {
    total_cost: mockUsers.reduce((a, u) => a + Number(u.cost), 0) + 42.5,
    request_count: 4827,
    turn_count: 3215,
    avg_cost_per_turn: 0.58,
    total_input_tokens: 12_500_000,
    total_cached_tokens: 4_375_000,
    by_model: models.map((m, i) => ({
      key: m,
      cost: [520, 385, 270, 145, 92][i],
      requests: [1200, 980, 740, 520, 310][i],
    })),
    by_channel: [
      { key: 'web', cost: 980, requests: 3200 },
      { key: 'slack', cost: 310, requests: 850 },
      { key: 'autonomous', cost: 42.5, requests: 180 },
    ],
    by_day: Array.from({ length: 14 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - 13 + i)
      return {
        day: d.toISOString().slice(0, 10),
        cost: 70 + Math.random() * 50,
        tokens: Math.floor(50000 + Math.random() * 80000),
        requests: Math.floor(200 + Math.random() * 200),
      }
    }),
    range_from: new Date(Date.now() - 14 * 86400000).toISOString(),
    range_to: new Date().toISOString(),
  }

  const mockPrior = {
    total_cost: mockSummary.total_cost * 0.82,
    request_count: 3850,
    turn_count: 2640,
    avg_cost_per_turn: 0.52,
    total_input_tokens: 9_800_000,
    total_cached_tokens: 2_940_000,
  }

  const mockTimeseries = []
  const providers = ['anthropic', 'openai', 'google']
  for (let i = 0; i < 14; i++) {
    const d = new Date()
    d.setDate(d.getDate() - 13 + i)
    const bucket = d.toISOString().slice(0, 10)
    providers.forEach((p) => {
      mockTimeseries.push({
        bucket,
        key: p,
        cost: (p === 'anthropic' ? 40 : p === 'openai' ? 30 : 12) + Math.random() * 20,
      })
    })
  }

  const channels = ['web', 'slack']
  const statuses = [null, null, null, null, null, null, null, 'timeout', null, null]
  const mockEvents = Array.from({ length: 30 }, (_, i) => {
    const occ = new Date()
    occ.setMinutes(occ.getMinutes() - i * 47)
    const userIdx = Math.floor(Math.random() * names.length)
    return {
      id: `evt_${i}`,
      turn_id: `turn_${i}`,
      occurred_at: occ.toISOString(),
      channel: channels[Math.floor(Math.random() * channels.length)],
      model: models[Math.floor(Math.random() * models.length)],
      total_cost: (0.02 + Math.random() * 0.8).toFixed(4),
      latency_ms: Math.floor(800 + Math.random() * 5000),
      user_name: names[userIdx],
      user_id: `usr_${String(userIdx + 1).padStart(3, '0')}`,
      error_kind: statuses[i % statuses.length],
      is_fallback: i === 5,
    }
  })

  return { mockSummary, mockPrior, mockTimeseries, mockUsers, mockEvents }
}

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

export function CostDashboardPage() {
  const { user } = useAuth()
  const isAdmin = !!user?.is_admin
  const navigate = useNavigate()
  const [demo, setDemo] = useState(false)

  const { filters, setFilters, toggleInArray, clearAll, apiParams } =
    useCostFilters()
  const paramsKey = useMemo(() => JSON.stringify(apiParams), [apiParams])

  const mock = useMemo(() => (demo ? generateMockData() : null), [demo])

  const {
    data: realSummary,
    loading: summaryLoadingReal,
    error: summaryError,
  } = useCostData(
    () =>
      isAdmin
        ? CostService.getSummary(apiParams)
        : CostService.getMySummary(apiParams),
    [paramsKey, isAdmin],
  )

  const { data: realPriorSummary } = useCostData(
    () => {
      if (!realSummary) return Promise.resolve(null)
      const prior = priorRangeParams(
        filters.range,
        realSummary.range_from,
        realSummary.range_to,
      )
      const params = { ...apiParams, ...prior }
      return isAdmin
        ? CostService.getSummary(params).catch(() => null)
        : CostService.getMySummary(params).catch(() => null)
    },
    [realSummary, filters.range, paramsKey, isAdmin],
  )

  const granularity = filters.range === '24h' ? 'hour' : 'day'
  const { data: realTimeseries, loading: tsLoadingReal } = useCostData(
    () => {
      if (!isAdmin) return Promise.resolve([])
      return CostService.getTimeseries({
        ...apiParams,
        granularity,
        group_by: 'provider',
      })
    },
    [paramsKey, isAdmin, granularity],
  )

  const { data: realUsers, loading: usersLoadingReal } = useCostData(
    () => (isAdmin ? CostService.getUsers(apiParams) : Promise.resolve([])),
    [paramsKey, isAdmin],
  )

  const summary = demo ? mock.mockSummary : realSummary
  const priorSummary = demo ? mock.mockPrior : realPriorSummary
  const timeseries = demo ? mock.mockTimeseries : realTimeseries
  const users = demo ? mock.mockUsers : realUsers
  const summaryLoading = demo ? false : summaryLoadingReal
  const tsLoading = demo ? false : tsLoadingReal
  const usersLoading = demo ? false : usersLoadingReal

  // Deltas
  const totalCostDelta = computeDelta(summary?.total_cost, priorSummary?.total_cost)
  const turnsDelta = computeDelta(summary?.turn_count, priorSummary?.turn_count)
  const avgCostDelta = computeDelta(summary?.avg_cost_per_turn, priorSummary?.avg_cost_per_turn)
  const cacheRatio =
    summary && summary.total_input_tokens > 0
      ? summary.total_cached_tokens / summary.total_input_tokens
      : null
  const priorCacheRatio =
    priorSummary && priorSummary.total_input_tokens > 0
      ? priorSummary.total_cached_tokens / priorSummary.total_input_tokens
      : null
  const cacheDelta = computeDelta(
    cacheRatio !== null ? cacheRatio * 100 : null,
    priorCacheRatio !== null ? priorCacheRatio * 100 : null,
  )

  // Derived stats for the icon cards
  const chatModels = filterChatModels(summary?.by_model)
  const topModel = chatModels?.length
    ? chatModels.reduce((a, b) => (Number(b.cost) > Number(a.cost) ? b : a))
    : null

  const activeUserCount = (users || []).filter((u) => !isSystemUser(u)).length

  const systemCost = (summary?.by_channel || [])
    .filter((c) => c.key === 'autonomous')
    .reduce((acc, c) => acc + (Number(c.cost) || 0), 0)


  // Area chart data
  const { rows: tsRows, keys: tsKeys } = useMemo(() => {
    if (isAdmin || demo) return pivotTimeseries(timeseries)
    const byDay = summary?.by_day || []
    return {
      rows: byDay.map((d) => ({ bucket: d.day, day: d.day, cost: d.cost })),
      keys: [],
    }
  }, [isAdmin, demo, timeseries, summary])

  return (
    <CostShell>
      <CostFilters
        filters={filters}
        setFilters={setFilters}
        toggleInArray={toggleInArray}
        clearAll={clearAll}
        showAdminOnly={isAdmin}
      />

      <div className="mx-auto w-full max-w-7xl space-y-5 px-5 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isAdmin ? 'Cost dashboard' : 'Your usage'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? 'AI spending across all users and channels.'
                : 'Your personal AI usage and spending.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={demo ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDemo((d) => !d)}
            >
              {demo ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
              {demo ? 'Hide sample data' : 'Preview with sample data'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/cost/models')}
            >
              Model pricing
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>

        {demo && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
            <strong>Sample data mode</strong> — Showing 20 mock users and realistic data to preview the dashboard layout. Click "Hide sample data" to return to real data.
          </div>
        )}

        {summaryError && summaryError.status === 403 ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            You don't have access to this view.
          </div>
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
            delta={cacheDelta}
            loading={summaryLoading}
          />
        </KpiStrip>

        {/* Quick stats row — Tabler-style icon cards */}
        <StatStrip>
          <StatCard
            icon={Crown}
            label="Top model"
            value={topModel ? modelLabel(topModel.key) : '—'}
            sublabel={topModel ? formatMoneyCompact(topModel.cost) : undefined}
            loading={summaryLoading}
          />
          <StatCard
            icon={Users}
            label="Active users"
            value={activeUserCount.toLocaleString()}
            sublabel="in this period"
            loading={usersLoading}
          />

          <StatCard
            icon={Cpu}
            label="System cost"
            value={formatMoneyCompact(systemCost)}
            sublabel="Embeddings & background"
            loading={summaryLoading}
          />
        </StatStrip>

        {/* Charts row — pie + area side by side */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <CostDonutChart
            title="Spending by AI model"
            rows={chatModels}
            loading={summaryLoading}
            context="model"
            onSliceClick={(key) => {
              if (key) toggleInArray('model', key)
            }}
          />
          <CostAreaChart
            title={
              isAdmin
                ? 'Spending over time (by provider)'
                : 'Spending over time'
            }
            data={tsRows}
            seriesKeys={tsKeys.length ? tsKeys : undefined}
            height={300}
            loading={tsLoading || summaryLoading}
          />
        </div>

        {/* User spending list (admin or demo) */}
        {(isAdmin || demo) && (
          <UserSpendChart
            rows={users}
            loading={usersLoading}
            title="Spending by user"
          />
        )}


      </div>
    </CostShell>
  )
}
