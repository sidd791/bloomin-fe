import React from 'react'
import { MessageSquare, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  formatDateTime,
  formatMoney,
  modelLabel,
} from '@/lib/cost-format'

export function SessionsTable({ sessions, loading, title = 'Most expensive conversations' }) {
  const rows = sessions || []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        {rows.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? 'session' : 'sessions'}
          </span>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <div className="space-y-2 px-5 pb-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted/50" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No conversations found in this period.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Conversation</TableHead>
                <TableHead>Model used</TableHead>
                <TableHead className="text-right">Messages</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Last active</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.session_id}>
                  <TableCell className="pl-5 max-w-[280px]">
                    <p className="truncate text-sm font-medium">
                      {row.title || 'Untitled conversation'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Started {formatDateTime(row.first_message_at)}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.top_model ? modelLabel(row.top_model) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {(row.turn_count ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {formatMoney(row.total_cost)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(row.last_message_at)}
                  </TableCell>
                  <TableCell>
                    {row.error_count > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-2.5 w-2.5" />
                        {row.error_count} {row.error_count === 1 ? 'error' : 'errors'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                        OK
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
