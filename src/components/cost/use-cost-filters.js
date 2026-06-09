import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

const ARRAY_KEYS = ['channel', 'provider', 'model', 'mode', 'tool']
const RANGE_VALUES = new Set(['24h', '7d', '30d', 'custom'])

export function useCostFilters(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(() => {
    let range = searchParams.get('range') || defaults.range || '7d'
    if (!RANGE_VALUES.has(range)) range = '7d'

    const result = {
      range,
      from: searchParams.get('from') || '',
      to: searchParams.get('to') || '',
      errorOnly: searchParams.get('error_only') === '1',
    }
    ARRAY_KEYS.forEach((key) => {
      result[key] = searchParams.getAll(key)
    })
    return result
  }, [searchParams, defaults.range])

  const setFilters = useCallback(
    (updater) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          const draft = {
            range: next.get('range') || '7d',
            from: next.get('from') || '',
            to: next.get('to') || '',
            errorOnly: next.get('error_only') === '1',
          }
          ARRAY_KEYS.forEach((key) => {
            draft[key] = next.getAll(key)
          })

          const update = typeof updater === 'function' ? updater(draft) : updater

          if (update.range !== undefined) next.set('range', update.range)
          ;['from', 'to'].forEach((k) => {
            if (update[k] !== undefined) {
              if (update[k]) next.set(k, update[k])
              else next.delete(k)
            }
          })
          if (update.errorOnly !== undefined) {
            if (update.errorOnly) next.set('error_only', '1')
            else next.delete('error_only')
          }
          ARRAY_KEYS.forEach((key) => {
            if (update[key] !== undefined) {
              next.delete(key)
              ;(update[key] || []).forEach((v) => v && next.append(key, v))
            }
          })

          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const toggleInArray = useCallback(
    (key, value) => {
      setFilters((prev) => {
        const list = prev[key] || []
        const has = list.includes(value)
        return { [key]: has ? list.filter((v) => v !== value) : [...list, value] }
      })
    },
    [setFilters],
  )

  const clearAll = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  // Build params object for API calls
  const apiParams = useMemo(() => {
    const out = { range: filters.range }
    if (filters.range === 'custom') {
      if (filters.from) out.from = filters.from
      if (filters.to) out.to = filters.to
    }
    ARRAY_KEYS.forEach((key) => {
      if (filters[key]?.length) out[key] = filters[key]
    })
    if (filters.errorOnly) out.error_only = '1'
    return out
  }, [filters])

  return { filters, setFilters, toggleInArray, clearAll, apiParams }
}
