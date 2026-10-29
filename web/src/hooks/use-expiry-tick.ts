import { useEffect, useMemo, useState } from 'react'

export function useExpiryTick(expirations: readonly string[]) {
  const [now, setNow] = useState(Date.now)
  const nextExpiration = useMemo(
    () =>
      expirations
        .map(Date.parse)
        .filter((expiresAt) => expiresAt > now)
        .sort((left, right) => left - right)[0],
    [expirations, now]
  )

  useEffect(() => {
    if (nextExpiration === undefined) return
    let timeoutId: number | undefined
    const updateAtExpiration = () => {
      const remaining = nextExpiration - Date.now()
      if (remaining <= 0) {
        setNow(Date.now())
        return
      }
      timeoutId = window.setTimeout(updateAtExpiration, remaining)
    }
    updateAtExpiration()
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [nextExpiration])

  return now
}
