import React, { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AlertTriangle, ServerOff } from 'lucide-react'
import { CostShell } from '@/components/cost/cost-shell'
import { BillingFilters } from '@/components/billing/BillingFilters'
import { BillingKPICards } from '@/components/billing/BillingKPICards'
import { BillingAreaChart } from '@/components/billing/BillingAreaChart'
import { BillingDonutChart } from '@/components/billing/BillingDonutChart'
import { BillingBarChart } from '@/components/billing/BillingBarChart'
import { BillingModelTable } from '@/components/billing/BillingModelTable'
import { useBillingData } from '@/hooks/use-billing-data'
import { useAuth } from '@/contexts/auth-context'
import { providerColor } from '@/lib/cost-format'

const PROVIDER_LABELS = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google' }

export function BillingDashboardPage() {
  const { user } = useAuth()
  const [range, setRange] = useState('30d')
  const [selectedProviders, setSelectedProviders] = useState([])

  if (!user?.is_admin) {
    return <Navigate to="/" replace />
  }

  const { providers, usage, timeseries, modelTimeseries, loading, error } =
    useBillingData(range)

  const configuredProviders = useMemo(() => {
    if (!providers?.providers) return []
    return providers.providers.filter((p) => p.configured).map((p) => p.id)
  }, [providers])

  const noProviders = !loading && configuredProviders.length === 0

  const filteredUsage = useMemo(() => {
    if (!usage || selectedProviders.length === 0) return usage
    const filtered = {
      ...usage,
      providers: usage.providers.filter((p) =>
        selectedProviders.includes(p.provider),
      ),
    }
    filtered.grand_total_usd = filtered.providers.reduce(
      (s, p) => s + p.total_cost_usd,
      0,
    )
    return filtered
  }, [usage, selectedProviders])

  const filteredTimeseries = useMemo(() => {
    if (!timeseries?.points || selectedProviders.length === 0) return timeseries
    return {
      ...timeseries,
      points: timeseries.points.filter((p) =>
        selectedProviders.includes(p.key),
      ),
    }
  }, [timeseries, selectedProviders])

  const providerDonutData = useMemo(() => {
    if (!filteredUsage?.providers) return []
    return filteredUsage.providers.map((p) => ({
      name: PROVIDER_LABELS[p.provider] || p.provider,
      value: p.total_cost_usd,
      _provider: p.provider,
    }))
  }, [filteredUsage])

  const allModels = useMemo(() => {
    if (!filteredUsage?.providers) return []
    const flat = []
    for (const p of filteredUsage.providers) {
      for (const m of p.models) {
        flat.push({
          name: m.model,
          value: m.cost_usd,
          provider: p.provider,
        })
      }
    }
    return flat.sort((a, b) => b.value - a.value)
  }, [filteredUsage])

  const modelDonutData = useMemo(() => allModels, [allModels])
  const barData = useMemo(() => allModels.slice(0, 10), [allModels])

  const hasNoData =
    !loading && filteredUsage && filteredUsage.grand_total_usd === 0

  const toggleProvider = (id) => {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
  }

  return (
    <CostShell>
      <BillingFilters
        range={range}
        onRangeChange={setRange}
        selectedProviders={selectedProviders}
        onToggleProvider={toggleProvider}
        onClearProviders={() => setSelectedProviders([])}
        configuredProviders={configuredProviders}
      />

      <div className="mx-auto w-full max-w-7xl space-y-5 px-5 py-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {error.message || 'Failed to load billing data. Please try again.'}
            </span>
          </div>
        )}

        {noProviders ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <ServerOff className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">
                No AI providers configured
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Contact your admin to set up API keys for OpenAI, Anthropic, or
                Google.
              </p>
            </div>
          </div>
        ) : (
          <>
            <BillingKPICards
              usage={filteredUsage}
              configuredProviders={configuredProviders}
              loading={loading}
            />

            {hasNoData && !loading && (
              <div className="flex items-center justify-center rounded-lg border border-border py-12 text-sm text-muted-foreground">
                No usage data found for the selected time range.
              </div>
            )}

            <BillingAreaChart
              title="Spending Over Time"
              points={filteredTimeseries?.points}
              loading={loading}
            />

            <div className="grid gap-5 lg:grid-cols-3">
              <BillingDonutChart
                title="By Provider"
                data={providerDonutData}
                loading={loading}
                colorFn={(name) => {
                  const entry = providerDonutData.find((d) => d.name === name)
                  return entry
                    ? providerColor(entry._provider)
                    : providerColor(name)
                }}
              />
              <BillingDonutChart
                title="By Model"
                data={modelDonutData}
                loading={loading}
                maxSlices={8}
              />
              <BillingBarChart
                title="Top Models"
                data={barData}
                loading={loading}
                max={10}
              />
            </div>

            <BillingModelTable usage={filteredUsage} loading={loading} />
          </>
        )}
      </div>
    </CostShell>
  )
}
