import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Generic async data hook. `fn` is invoked with no arguments and should return
 * a promise. `deps` is the dependency list that triggers refetches.
 */
export function useCostData(fn, deps) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const reqId = useRef(0)

  const refresh = useCallback(() => {
    reqId.current += 1
    const myReq = reqId.current
    setLoading(true)
    setError(null)
    fn()
      .then((result) => {
        if (myReq !== reqId.current) return
        setData(result)
        setError(null)
      })
      .catch((err) => {
        if (myReq !== reqId.current) return
        setError(err)
        setData(null)
      })
      .finally(() => {
        if (myReq !== reqId.current) return
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, error, loading, refresh }
}
