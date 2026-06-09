import React, { useEffect, useState } from 'react'
import { Check, ChevronDown, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { CostService } from '@/services/cost.service'
import { cn } from '@/lib/utils'

const RANGE_OPTIONS = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

const CHANNEL_OPTIONS = [
  { value: 'web', label: 'Web chat' },
  { value: 'slack', label: 'Slack' },
  { value: 'autonomous', label: 'Automated' },
]
const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
]
const MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'thinking', label: 'Deep thinking' },
  { value: 'balanced', label: 'Balanced' },
]

function MultiSelect({ label, selected, options, onToggle, onClear }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <span className="text-muted-foreground">{label}</span>
          {selected?.length > 0 ? (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0">
              {selected.length}
            </Badge>
          ) : null}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        {options.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No options</div>
        )}
        {options.map((opt) => {
          const value = typeof opt === 'string' ? opt : opt.value
          const display = typeof opt === 'string' ? opt : opt.label
          const checked = selected?.includes(value)
          return (
            <DropdownMenuItem
              key={value}
              onSelect={(e) => {
                e.preventDefault()
                onToggle(value)
              }}
              className="cursor-pointer"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate">{display}</span>
                {checked && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
            </DropdownMenuItem>
          )
        })}
        {selected?.length > 0 && (
          <>
            <div className="my-1 h-px bg-border" />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                onClear()
              }}
              className="text-xs text-muted-foreground"
            >
              Clear selection
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RangePicker({ filters, setFilters }) {
  const current = RANGE_OPTIONS.find((r) => r.value === filters.range)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <span className="text-muted-foreground">Range:</span>
          <span className="font-medium">
            {current ? current.label : filters.range}
          </span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {RANGE_OPTIONS.map((r) => (
          <DropdownMenuItem
            key={r.value}
            onSelect={() => setFilters({ range: r.value, from: '', to: '' })}
            className="cursor-pointer"
          >
            <div className="flex w-full items-center justify-between">
              <span>{r.label}</span>
              {filters.range === r.value && <Check className="h-3.5 w-3.5 text-primary" />}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function CostFilters({
  filters,
  setFilters,
  toggleInArray,
  clearAll,
  showAdminOnly = false,
  className,
}) {
  const [models, setModels] = useState([])

  useEffect(() => {
    let alive = true
    CostService.getModels()
      .then((data) => {
        if (alive) setModels(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (alive) setModels([])
      })
    return () => {
      alive = false
    }
  }, [])

  const modelOptions = models.map((m) => m.model_id).sort()

  const friendlyLookup = (opts, val) => {
    const found = opts.find((o) => (typeof o === 'string' ? o : o.value) === val)
    return found ? (typeof found === 'string' ? found : found.label) : val
  }

  const activeChips = []
  filters.channel?.forEach((v) => activeChips.push({ key: 'channel', value: v, label: `Source: ${friendlyLookup(CHANNEL_OPTIONS, v)}` }))
  filters.provider?.forEach((v) => activeChips.push({ key: 'provider', value: v, label: `Provider: ${friendlyLookup(PROVIDER_OPTIONS, v)}` }))
  filters.model?.forEach((v) => activeChips.push({ key: 'model', value: v, label: `Model: ${v}` }))
  filters.mode?.forEach((v) => activeChips.push({ key: 'mode', value: v, label: `Mode: ${friendlyLookup(MODE_OPTIONS, v)}` }))
  filters.tool?.forEach((v) => activeChips.push({ key: 'tool', value: v, label: `Tool: ${v}` }))
  if (filters.errorOnly) activeChips.push({ key: 'errorOnly', value: true, label: 'Errors only' })

  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex flex-col gap-2 border-b border-border bg-background/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <RangePicker filters={filters} setFilters={setFilters} />

        <MultiSelect
          label="Source"
          selected={filters.channel}
          options={CHANNEL_OPTIONS}
          onToggle={(v) => toggleInArray('channel', v)}
          onClear={() => setFilters({ channel: [] })}
        />

        <MultiSelect
          label="Provider"
          selected={filters.provider}
          options={PROVIDER_OPTIONS}
          onToggle={(v) => toggleInArray('provider', v)}
          onClear={() => setFilters({ provider: [] })}
        />

        <MultiSelect
          label="Model"
          selected={filters.model}
          options={modelOptions}
          onToggle={(v) => toggleInArray('model', v)}
          onClear={() => setFilters({ model: [] })}
        />

        <MultiSelect
          label="Mode"
          selected={filters.mode}
          options={MODE_OPTIONS}
          onToggle={(v) => toggleInArray('mode', v)}
          onClear={() => setFilters({ mode: [] })}
        />

        <Button
          variant={filters.errorOnly ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={() => setFilters({ errorOnly: !filters.errorOnly })}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Errors only
        </Button>

        {(activeChips.length > 0 || filters.range !== '7d') && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs text-muted-foreground"
            onClick={clearAll}
          >
            Reset filters
          </Button>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={`${chip.key}:${chip.value}`}
              type="button"
              onClick={() => {
                if (chip.key === 'errorOnly') setFilters({ errorOnly: false })
                else toggleInArray(chip.key, chip.value)
              }}
              className="group inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <span>{chip.label}</span>
              <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}

      {showAdminOnly && (
        <p className="text-[11px] text-muted-foreground">
          Viewing global data. Non-admin users only see their own activity.
        </p>
      )}
    </div>
  )
}
