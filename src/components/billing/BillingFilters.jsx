import React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const RANGE_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
]

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
]

export function BillingFilters({
  range,
  onRangeChange,
  selectedProviders,
  onToggleProvider,
  onClearProviders,
  configuredProviders,
}) {
  const current = RANGE_OPTIONS.find((r) => r.value === range)
  const availableProviders = PROVIDER_OPTIONS.filter(
    (p) => !configuredProviders || configuredProviders.includes(p.value),
  )

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => onRangeChange(r.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              range === r.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <span className="text-muted-foreground">Provider</span>
            {selectedProviders.length > 0 ? (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                {selectedProviders.length}
              </Badge>
            ) : (
              <span className="font-medium">All</span>
            )}
            <ChevronDown className="h-3 w-3 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48" align="start">
          {availableProviders.map((opt) => {
            const checked = selectedProviders.includes(opt.value)
            return (
              <DropdownMenuItem
                key={opt.value}
                onSelect={(e) => {
                  e.preventDefault()
                  onToggleProvider(opt.value)
                }}
                className="cursor-pointer"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span>{opt.label}</span>
                  {checked && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
              </DropdownMenuItem>
            )
          })}
          {selectedProviders.length > 0 && (
            <>
              <div className="my-1 h-px bg-border" />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  onClearProviders()
                }}
                className="text-xs text-muted-foreground"
              >
                Clear selection
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
