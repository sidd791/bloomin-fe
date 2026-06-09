import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { formatMoney, modelLabel } from '@/lib/cost-format'

export function UserLeaderboard({ rows, loading, title = 'User leaderboard' }) {
  const navigate = useNavigate()
  const sorted = [...(rows || [])].sort(
    (a, b) => Number(b.cost) - Number(a.cost),
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        {sorted.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {sorted.length} {sorted.length === 1 ? 'user' : 'users'}
          </span>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <div className="space-y-2 px-5 pb-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-muted/50" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No user activity in range.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">#</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Total cost</TableHead>
                <TableHead className="text-right">Messages</TableHead>
                <TableHead>Favourite model</TableHead>
                <TableHead className="pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row, idx) => {
                const clickable = !!row.user_id
                return (
                  <TableRow
                    key={`${row.user_id || row.name}-${idx}`}
                    className={clickable ? 'cursor-pointer' : ''}
                    onClick={() => {
                      if (clickable) navigate(`/cost/users/${row.user_id}`)
                    }}
                  >
                    <TableCell className="pl-5 text-xs text-muted-foreground tabular-nums">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.name}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {row.email || '—'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(row.cost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {row.turns?.toLocaleString() ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.top_model ? modelLabel(row.top_model) : '—'}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      {clickable && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/cost/users/${row.user_id}`)
                          }}
                          title="Open user"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
