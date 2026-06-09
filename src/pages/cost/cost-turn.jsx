import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  AlertCircle,
  Wrench,
  Zap,
  RefreshCcw,
  Info,
} from 'lucide-react'
import { CostShell } from '@/components/cost/cost-shell'
import { useCostData } from '@/components/cost/use-cost-data'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CostService } from '@/services/cost.service'
import {
  formatDateTime,
  formatLatency,
  formatMoney,
  formatTokens,
  modelLabel,
  providerColor,
} from '@/lib/cost-format'

function HopRow({ hop, index, total }) {
  return (
    <div className="relative pl-7">
      <div className="absolute left-2 top-3 flex flex-col items-center">
        <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-background text-[10px] font-semibold text-primary">
          {hop.hop_index ?? index}
        </span>
        {index < total - 1 && (
          <span className="mt-1 h-full w-px flex-1 bg-border" />
        )}
      </div>

      <Card className="mb-3">
        <CardContent className="space-y-2 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Badge
                variant="outline"
                className="font-mono text-[10px]"
                style={{ color: providerColor(hop.provider) }}
              >
                {hop.provider}
              </Badge>
              <span className="truncate text-sm font-medium">
                {modelLabel(hop.model)}
              </span>
              {hop.mode && (
                <Badge variant="muted">{hop.mode}</Badge>
              )}
              {hop.request_kind && hop.request_kind !== 'chat' && (
                <Badge variant="secondary">{hop.request_kind}</Badge>
              )}
              {hop.streaming && (
                <Badge variant="outline">streaming</Badge>
              )}
              {hop.service_tier === 'priority' && (
                <Badge variant="default">
                  <Zap className="mr-1 h-2.5 w-2.5" />
                  priority
                </Badge>
              )}
              {hop.is_fallback && (
                <Badge variant="warning" title="Retried after primary failed">
                  <RefreshCcw className="mr-1 h-2.5 w-2.5" />
                  fallback
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs tabular-nums">
              <span className="text-muted-foreground">
                {formatLatency(hop.latency_ms)}
              </span>
              <span className="font-semibold">{formatMoney(hop.total_cost)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Input" value={formatTokens(hop.input_tokens)} />
            <Metric
              label="Cached input"
              value={formatTokens(hop.cached_input_tokens)}
              muted
            />
            <Metric label="Output" value={formatTokens(hop.output_tokens)} />
            <Metric
              label="Total tokens"
              value={formatTokens(
                (hop.input_tokens || 0) + (hop.output_tokens || 0),
              )}
              muted
            />
          </div>

          {hop.had_tool_calls && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Wrench className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Tools:</span>
              {(hop.tool_names || []).map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          )}

          {hop.error_kind && (
            <div className="flex items-center gap-1.5 rounded border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {hop.error_kind}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            {formatDateTime(hop.occurred_at)} · hop_id {hop.id?.slice(0, 8)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value, muted }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-sm font-medium tabular-nums ${muted ? 'text-muted-foreground' : ''}`}
      >
        {value}
      </p>
    </div>
  )
}

export function CostTurnPage() {
  const { turnId } = useParams()
  const navigate = useNavigate()

  // Try the "self" endpoint first. Backend will 404/403 if not your turn —
  // admins can also use a fallback through /cost/events filtered by turn_id.
  const { data, loading, error } = useCostData(
    () => CostService.getMyTurn(turnId),
    [turnId],
  )

  const hops = Array.isArray(data) ? [...data].sort((a, b) => a.hop_index - b.hop_index) : []

  const totalCost = hops.reduce((acc, h) => acc + (Number(h.total_cost) || 0), 0)
  const totalTokens = hops.reduce(
    (acc, h) =>
      acc + (Number(h.input_tokens) || 0) + (Number(h.output_tokens) || 0),
    0,
  )
  const totalLatency = hops.reduce((acc, h) => acc + (Number(h.latency_ms) || 0), 0)
  const firstHop = hops[0]

  return (
    <CostShell>
      <div className="mx-auto w-full max-w-4xl space-y-4 px-5 py-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Turn {turnId?.slice(0, 8)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {firstHop
                ? `${firstHop.user_name || firstHop.slack_display_name || 'Unknown'} · ${formatDateTime(firstHop.occurred_at)}`
                : 'Per-hop drill-down'}
            </p>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="space-y-2 py-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded bg-muted/50" />
              ))}
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm font-medium">
                {error.status === 404
                  ? 'Turn not found.'
                  : error.status === 403
                    ? "You don't have access to this turn."
                    : 'Could not load turn.'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {turnId}
              </p>
            </CardContent>
          </Card>
        ) : hops.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No hops recorded for this turn.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Hops" value={hops.length} />
                <Metric label="Total cost" value={formatMoney(totalCost)} />
                <Metric label="Total tokens" value={formatTokens(totalTokens)} />
                <Metric
                  label="End-to-end latency"
                  value={formatLatency(totalLatency)}
                />
              </CardContent>
            </Card>

            <div>
              {hops.map((hop, idx) => (
                <HopRow
                  key={hop.id || idx}
                  hop={hop}
                  index={idx}
                  total={hops.length}
                />
              ))}
            </div>

            <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                Each hop snapshots the exact pricing version used at the time of
                the call, so historical totals don't shift if a model is later
                re-priced.
              </p>
            </div>
          </>
        )}
      </div>
    </CostShell>
  )
}
