import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { formatMoney } from '@/lib/cost-format'
import { providerColor } from '@/lib/cost-format'

function ProviderIcon({ provider }) {
  const color = providerColor(provider)
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
      style={{ background: color }}
    />
  )
}

function KpiCard({ label, value, icon, loading, accent }) {
  return (
    <Card className="overflow-hidden">
      {accent && (
        <div className="h-1" style={{ background: accent }} />
      )}
      <CardContent className="px-5 py-4">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        </div>
        {loading ? (
          <div className="mt-2 h-7 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function BillingKPICards({ usage, configuredProviders, loading }) {
  const providerMap = {}
  if (usage?.providers) {
    for (const p of usage.providers) {
      providerMap[p.provider] = p.total_cost_usd
    }
  }

  const PROVIDER_LABELS = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google' }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="Total Spend"
        value={formatMoney(usage?.grand_total_usd)}
        loading={loading}
        accent="var(--primary)"
      />
      {configuredProviders?.map((id) => (
        <KpiCard
          key={id}
          label={PROVIDER_LABELS[id] || id}
          value={formatMoney(providerMap[id] ?? 0)}
          icon={<ProviderIcon provider={id} />}
          loading={loading}
          accent={providerColor(id)}
        />
      ))}
    </div>
  )
}
