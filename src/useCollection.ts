import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readSeeds, readStats, readToken, type CollectionStats, type Token } from './chain'

const WORKERS = 3
const HOME_REVEALED = 12
const WORKER_PAUSE_MS = 350
const pause = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds))

export function useCollection(galleryActive: boolean) {
  const [stats, setStats] = useState<CollectionStats | null>(null)
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingTokens, setLoadingTokens] = useState(false)
  const [tokenErrors, setTokenErrors] = useState(0)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const records = useRef(new Map<number, Token>())
  const failures = useRef(new Set<number>())
  const inFlight = useRef(0)
  const request = useRef(0)
  const cancelMetadata = useRef<(() => void) | null>(null)

  const refresh = useCallback(async () => {
    const current = ++request.current
    cancelMetadata.current?.()
    setLoadingTokens(false)
    setLoading(true)
    setError(null)
    try {
      const next = await readStats()
      if (current !== request.current) return
      records.current = new Map()
      failures.current = new Set()
      setTokens([])
      setTokenErrors(0)
      setTokenError(null)
      setStats(next)
    } catch {
      if (current !== request.current) return
      setError('Ethereum RPC unavailable. Retry to read the latest collection data. Any data already shown is from the last successful snapshot.')
    } finally {
      if (current === request.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return () => { request.current += 1; cancelMetadata.current?.() }
  }, [refresh])

  useEffect(() => {
    if (!stats) return
    let cancelled = false
    cancelMetadata.current = () => { cancelled = true }
    const snapshotRecords = records.current
    const snapshotFailures = failures.current
    let lastPublish = 0
    const publish = (force = false) => {
      if (cancelled || (!force && Date.now() - lastPublish < 180)) return
      lastPublish = Date.now()
      setTokens([...snapshotRecords.values()].sort((a, b) => a.id - b.id))
      setTokenErrors(snapshotFailures.size)
    }

    const run = async () => {
      setLoadingTokens(true)
      const seeds = new Map<number, bigint>()
      let targets: number[] = []
      try {
        if (galleryActive) {
          const allIds = Array.from({ length: stats.totalMinted }, (_, index) => index + 1)
          // Load the first gallery page and newest mints promptly; the remaining scan stays progressive.
          targets = [...new Set([...allIds.slice(0, 24), ...allIds.slice(-24), ...allIds])]
        } else {
          const pending: number[] = []
          for (let start = 1; start <= stats.totalMinted && targets.length < HOME_REVEALED; start += 64) {
            if (start > 1) await pause(WORKER_PAUSE_MS)
            if (cancelled) return
            const ids = Array.from({ length: Math.min(64, stats.totalMinted - start + 1) }, (_, index) => start + index)
            const batch = await readSeeds(ids, stats.blockNumber)
            if (cancelled) return
            for (const [id, seed] of batch) {
              seeds.set(id, seed)
              if (seed !== 0n && targets.length < HOME_REVEALED) targets.push(id)
              else if (seed === 0n && pending.length < 4) pending.push(id)
            }
          }
          if (!targets.length) targets = pending
        }
        const queue = targets.filter(id => !snapshotRecords.has(id) && !snapshotFailures.has(id))
        let cursor = 0
        let consecutiveFailures = 0
        const worker = async (index: number) => {
          // Stagger workers and leave a gap between reads to respect shared public RPC limits.
          await pause(index * 120)
          while (!cancelled && cursor < queue.length && consecutiveFailures < 6) {
            // Old HTTP requests may still be settling after a tab change or refresh.
            while (!cancelled && inFlight.current >= WORKERS) await pause(50)
            if (cancelled || cursor >= queue.length || consecutiveFailures >= 6) return
            const id = queue[cursor++]
            inFlight.current += 1
            try {
              const token = await readToken(id, stats.blockNumber, seeds.get(id))
              if (cancelled) return
              snapshotRecords.set(id, token)
              consecutiveFailures = 0
            } catch {
              if (cancelled) return
              snapshotFailures.add(id)
              consecutiveFailures += 1
              setTokenError('Some on-chain art could not be read. Retry missing tokens to complete the collection and its trait counts.')
            } finally {
              inFlight.current -= 1
            }
            publish()
            if (cursor < queue.length && consecutiveFailures < 6) {
              await pause(consecutiveFailures ? Math.min(5_000, consecutiveFailures * 750) : WORKER_PAUSE_MS)
            }
          }
        }
        await Promise.all(Array.from({ length: Math.min(WORKERS, queue.length) }, (_, index) => worker(index)))
        if (!cancelled && cursor < queue.length) {
          setTokenError('Art loading paused after repeated RPC failures. Retry missing tokens when the connection recovers.')
        }
      } catch {
        if (cancelled) return
        snapshotFailures.add(-1)
        setTokenError('The Ethereum RPC could not read the token seeds. Retry to load the on-chain artwork.')
      } finally {
        if (!cancelled) {
          publish(true)
          setLoadingTokens(false)
        }
      }
    }
    void run()
    return () => { cancelled = true }
  }, [stats, galleryActive, retry])

  const retryTokens = useCallback(() => {
    failures.current.clear()
    setTokenErrors(0)
    setTokenError(null)
    setRetry(value => value + 1)
  }, [])

  const rarity = useMemo(() => {
    const counts = new Map<string, Map<string, number>>()
    for (const token of tokens) {
      for (const trait of token.attributes) {
        let values = counts.get(trait.trait_type)
        if (!values) { values = new Map(); counts.set(trait.trait_type, values) }
        values.set(trait.value, (values.get(trait.value) ?? 0) + 1)
      }
    }
    return counts
  }, [tokens])

  return {
    stats,
    tokens,
    loading,
    error,
    loadingTokens,
    tokenErrors,
    tokenError,
    progress: { loaded: tokens.length, total: stats?.totalMinted ?? 0 },
    complete: stats !== null && !loading && !error && tokens.length === stats.totalMinted && tokenErrors === 0,
    rarity,
    refresh,
    retryTokens,
  }
}
