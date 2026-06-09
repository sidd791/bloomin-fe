import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, AlertCircle } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import {
  formatDateTime,
  formatLatency,
  formatMoney,
  modelLabel,
  friendlyChannel,
} from '@/lib/cost-format'

function ChannelBadge({ channel }) {
  const map = {
    web: { variant: 'default' },
    slack: { variant: 'secondary' },
    autonomous: { variant: 'muted' },
  }
  const cfg = map[channel] || { variant: 'outline' }
  return <Badge variant={cfg.variant}>{friendlyChannel(channel)}</Badge>
}


function UserCell({ row }) {
  const name = row.user_name || row.slack_display_name || 'Unknown'
  const sub = row.user_id ? 'web' : row.slack_user_id ? 'slack' : '—'
  return (
    <div className="min-w-0">
      <p className="truncate text-sm">{name}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  )
}

export function EventsTable({
  title = 'Recent events',
  events,
  loading,
  showUser = true,
  emptyHint = 'No events in range.',
  limit,
}) {
  const navigate = useNavigate()
  const rows = limit ? (events || []).slice(0, limit) : events || []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {events && (
          <span className="text-xs text-muted-foreground">
            {events.length} {events.length === 1 ? 'row' : 'rows'}
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
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            {emptyHint}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">When</TableHead>
                <TableHead>Source</TableHead>
                {showUser && <TableHead>User</TableHead>}
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Response time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/cost/turns/${row.turn_id}`)}
                >
                  <TableCell className="pl-5 whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(row.occurred_at)}
                  </TableCell>
                  <TableCell>
                    <ChannelBadge channel={row.channel} />
                  </TableCell>
                  {showUser && (
                    <TableCell>
                      <UserCell row={row} />
                    </TableCell>
                  )}
                  <TableCell>
                    <span className="text-sm font-medium">
                      {modelLabel(row.model)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {formatMoney(row.total_cost)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {formatLatency(row.latency_ms)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      {row.error_kind ? (
                        <Badge variant="destructive">
                          <AlertCircle className="mr-1 h-2.5 w-2.5" />
                          Error
                        </Badge>
                      ) : row.is_fallback ? (
                        <Badge variant="warning">Retried</Badge>
                      ) : (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                          OK
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/cost/turns/${row.turn_id}`)
                      }}
                      title="Open turn"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
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
