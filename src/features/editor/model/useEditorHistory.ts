import { useCallback, useState } from 'react'

export function useEditorHistory<T>(limit = 100) {
  const [past, setPast] = useState<T[]>([])
  const [future, setFuture] = useState<T[]>([])

  const push = useCallback((snapshot: T) => {
    setPast((items) => [...items, snapshot].slice(-limit))
    setFuture([])
  }, [limit])

  const undo = (current: T) => {
    const snapshot = past.at(-1)
    if (!snapshot) return null
    setPast((items) => items.slice(0, -1))
    setFuture((items) => [...items, current])
    return snapshot
  }

  const redo = (current: T) => {
    const snapshot = future.at(-1)
    if (!snapshot) return null
    setFuture((items) => items.slice(0, -1))
    setPast((items) => [...items, current].slice(-limit))
    return snapshot
  }

  const clear = useCallback(() => {
    setPast([])
    setFuture([])
  }, [])

  const discardFuture = useCallback(() => setFuture([]), [])

  return { past, future, push, undo, redo, clear, discardFuture }
}
