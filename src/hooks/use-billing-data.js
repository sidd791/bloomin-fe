import { useCallback, useEffect, useRef, useState } from 'react'
import { BillingService } from '@/services/billing.service'

export function useBillingData(range) {
  const [providers, setProviders] = useState(null)
  const [usage, setUsage] = useState(null)
  const [timeseries, setTimeseries] = useState(null)
  const [modelTimeseries, setModelTimeseries] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const reqId = useRef(0)

  const fetchAll = useCallback(() => {
    reqId.current += 1
    const myReq = reqId.current
    setLoading(true)
    setError(null)

    const providersPromise = providers
      ? Promise.resolve(providers)
      : BillingService.getProviders()

    Promise.all([
      providersPromise,
      BillingService.getUsage({ range }),
      BillingService.getTimeseries({ range, group_by: 'provider' }),
      BillingService.getTimeseries({ range, group_by: 'model' }),
    ])
      .then(([prov, usg, ts, mts]) => {
        if (myReq !== reqId.current) return
        setProviders(prov)
        setUsage(usg)
        setTimeseries(ts)
        setModelTimeseries(mts)
      })
      .catch((err) => {
        if (myReq !== reqId.current) return
        setError(err)
      })
      .finally(() => {
        if (myReq !== reqId.current) return
        setLoading(false)
      })
  }, [range])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { providers, usage, timeseries, modelTimeseries, loading, error, refresh: fetchAll }
}
