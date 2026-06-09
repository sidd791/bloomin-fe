import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Info, Search } from 'lucide-react'
import { CostShell } from '@/components/cost/cost-shell'
import { useCostData } from '@/components/cost/use-cost-data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { CostService } from '@/services/cost.service'
import { modelLabel, providerColor } from '@/lib/cost-format'

function fmtPrice(value) {
  if (value === null || value === undefined) return '—'
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return '—'
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

export function CostModelsPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const { data: models, loading, error } = useCostData(
    () => CostService.getModels(),
    [],
  )

  const filtered = useMemo(() => {
    if (!Array.isArray(models)) return []
    const q = query.trim().toLowerCase()
    if (!q) return models
    return models.filter(
      (m) =>
        m.model_id?.toLowerCase().includes(q) ||
        m.provider?.toLowerCase().includes(q) ||
        m.notes?.toLowerCase().includes(q),
    )
  }, [models, query])

  return (
    <CostShell>
      <div className="mx-auto w-full max-w-6xl space-y-4 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate('/cost')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Model pricing
              </h1>
              <p className="text-sm text-muted-foreground">
                Active rates per 1M tokens. Sourced from each provider's billing
                docs.
              </p>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter models..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 pl-7"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Active models
              {Array.isArray(models) && (
                <Badge variant="muted">{models.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {loading ? (
              <div className="space-y-2 px-5 pb-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded bg-muted/50" />
                ))}
              </div>
            ) : error ? (
              <div className="px-5 py-10 text-center text-sm text-destructive">
                {error.status === 401
                  ? 'Please log in to view model pricing.'
                  : 'Could not load model pricing.'}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No models match "{query}".
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Cached</TableHead>
                    <TableHead className="text-right">Cache write</TableHead>
                    <TableHead className="text-right">Priority</TableHead>
                    <TableHead className="pr-5">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow key={m.model_id}>
                      <TableCell className="pl-5 font-medium">
                        <span className="text-sm">{modelLabel(m.model_id)}</span>
                        <p className="text-[10px] font-normal text-muted-foreground">
                          {m.model_id}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                          style={{ color: providerColor(m.provider) }}
                        >
                          {m.provider}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtPrice(m.input_per_1m)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtPrice(m.output_per_1m)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {fmtPrice(m.cached_input_per_1m)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {fmtPrice(m.cache_write_per_1m)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.priority_multiplier
                          ? `${Number(m.priority_multiplier).toFixed(1)}×`
                          : '—'}
                      </TableCell>
                      <TableCell className="pr-5 text-xs text-muted-foreground">
                        {m.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            All values per 1M tokens. The first ~60 seconds after a price change
            can show stale numbers because the pricing cache TTL is 60s.
          </p>
        </div>
      </div>
    </CostShell>
  )
}
