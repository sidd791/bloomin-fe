import React, { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMoney, formatTokens, providerColor } from '@/lib/cost-format'

const PROVIDER_LABELS = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google' }

const COLUMNS = [
  { key: 'model', label: 'Model', sortable: true },
  { key: 'provider', label: 'Provider', sortable: true },
  { key: 'input_tokens', label: 'Input Tokens', sortable: true, align: 'right' },
  { key: 'output_tokens', label: 'Output Tokens', sortable: true, align: 'right' },
  { key: 'cost_usd', label: 'Cost', sortable: true, align: 'right' },
]

export function BillingModelTable({ usage, loading }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('cost_usd')
  const [sortDir, setSortDir] = useState('desc')

  const rows = useMemo(() => {
    if (!usage?.providers) return []
    const all = []
    for (const p of usage.providers) {
      for (const m of p.models) {
        all.push({
          model: m.model,
          provider: p.provider,
          input_tokens: m.input_tokens,
          output_tokens: m.output_tokens,
          cost_usd: m.cost_usd,
          requests: m.requests,
          cached_tokens: m.cached_tokens,
        })
      }
    }
    return all
  }, [usage])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let result = rows
    if (q) {
      result = result.filter(
        (r) =>
          r.model.toLowerCase().includes(q) ||
          (PROVIDER_LABELS[r.provider] || r.provider).toLowerCase().includes(q),
      )
    }
    result.sort((a, b) => {
      const aVal = a[sortKey] ?? 0
      const bVal = b[sortKey] ?? 0
      if (typeof aVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return result
  }, [rows, search, sortKey, sortDir])

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'model' || key === 'provider' ? 'asc' : 'desc')
    }
  }

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return null
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 inline h-3 w-3" />
      : <ArrowDown className="ml-1 inline h-3 w-3" />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Model Breakdown</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {loading ? (
          <div className="space-y-2 px-5 pb-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-muted/50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {rows.length === 0 ? 'No usage data.' : 'No models match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((col) => (
                    <TableHead
                      key={col.key}
                      className={`${col.align === 'right' ? 'text-right' : ''} ${col.sortable ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
                      onClick={() => col.sortable && toggleSort(col.key)}
                    >
                      {col.label}
                      <SortIcon col={col.key} />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={`${row.provider}-${row.model}`}>
                    <TableCell className="font-medium">{row.model}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: providerColor(row.provider) }}
                        />
                        {PROVIDER_LABELS[row.provider] || row.provider}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTokens(row.input_tokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTokens(row.output_tokens)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(row.cost_usd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
