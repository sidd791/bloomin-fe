import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  formatMoney,
  formatMoneyCompact,
  modelLabel,
  isSystemUser,
  CHART_PALETTE,
} from '@/lib/cost-format'

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

function UserRow({ user, maxCost, color, isExpanded, onToggle }) {
  const navigate = useNavigate()

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ background: color }}
        >
          {(user.name || '?')[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium truncate">{user.name || 'Unknown'}</p>
            <span className="text-sm font-semibold tabular-nums shrink-0">
              {formatMoney(user.cost)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[11px] text-muted-foreground truncate">
              {user.email || '—'}
            </p>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {(user.turns ?? 0).toLocaleString()} messages
            </span>
          </div>
          <div className="mt-1.5">
            <ProgressBar value={Number(user.cost) || 0} max={maxCost} color={color} />
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="bg-muted/20 px-4 py-3 pl-[4.25rem] space-y-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
            <div>
              <p className="text-muted-foreground">Top model</p>
              <p className="font-medium">{user.top_model ? modelLabel(user.top_model) : '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total cost</p>
              <p className="font-medium tabular-nums">{formatMoney(user.cost)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Messages</p>
              <p className="font-medium tabular-nums">{(user.turns ?? 0).toLocaleString()}</p>
            </div>
          </div>
          {user.user_id && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/cost/users/${user.user_id}`)
              }}
            >
              View full details
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function UserSpendChart({ rows, loading, title = 'Spending by user' }) {
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const { realUsers, maxCost } = useMemo(() => {
    const sorted = [...(rows || [])]
      .filter((r) => !isSystemUser(r))
      .sort((a, b) => Number(b.cost) - Number(a.cost))
    const q = search.trim().toLowerCase()
    const filtered = q
      ? sorted.filter(
          (r) =>
            (r.name || '').toLowerCase().includes(q) ||
            (r.email || '').toLowerCase().includes(q),
        )
      : sorted
    const max = filtered.length > 0 ? Number(filtered[0].cost) || 0 : 0
    return { realUsers: filtered, maxCost: max }
  }, [rows, search])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{title}</CardTitle>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {loading ? (
          <div className="space-y-2 px-4 pb-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-muted/50" />
            ))}
          </div>
        ) : realUsers.length === 0 ? (
          <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground pb-4">
            {search ? 'No users match your search.' : 'No user activity yet.'}
          </div>
        ) : (
          <div>
            {realUsers.map((user, idx) => (
              <UserRow
                key={user.user_id || idx}
                user={user}
                maxCost={maxCost}
                color={CHART_PALETTE[idx % CHART_PALETTE.length]}
                isExpanded={expandedId === (user.user_id || idx)}
                onToggle={() =>
                  setExpandedId(
                    expandedId === (user.user_id || idx)
                      ? null
                      : user.user_id || idx,
                  )
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
