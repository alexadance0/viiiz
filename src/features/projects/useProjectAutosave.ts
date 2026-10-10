import { useEffect, useRef, useState } from 'react'
import type { EditorProject } from './project'
import { loadDraft, saveDraft } from './storage'

export function useProjectAutosave(project: EditorProject | null, restore: (project: EditorProject) => void) {
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const current = useRef(project)
  current.current = project
  const restoreRef = useRef(restore)
  restoreRef.current = restore
  const saved = useRef<EditorProject | null>(null)
  const inFlight = useRef<EditorProject | null>(null)
  const mounted = useRef(true)
  const flush = useRef<() => void>(() => {})

  flush.current = () => {
    const snapshot = current.current
    if (!snapshot || snapshot === saved.current || snapshot === inFlight.current) return
    inFlight.current = snapshot
    if (mounted.current) setStatus('Сохраняем…')
    void saveDraft(snapshot).then(() => {
      saved.current = snapshot
      if (mounted.current && current.current === snapshot) { setStatus('Сохранено в браузере'); setError('') }
    }).catch(() => {
      if (mounted.current) { setStatus('Не сохранено'); setError('Автосохранение недоступно. Скачайте файл проекта, чтобы сохранить работу.') }
    }).finally(() => { if (inFlight.current === snapshot) inFlight.current = null })
  }
  useEffect(() => {
    mounted.current = true
    let active = true
    void loadDraft().then((draft) => {
      if (!active) return
      if (draft && !current.current) { restoreRef.current(draft); setStatus('Восстановлено из браузера') }
    }).catch(() => {
      if (active) setError('Не удалось восстановить автосохранение. Откройте файл проекта или начните новый.')
    }).finally(() => { if (active) setReady(true) })
    return () => { active = false; mounted.current = false; flush.current() }
  }, [])
  useEffect(() => {
    if (!ready || !project) return
    setStatus('Изменения не сохранены')
    const timer = window.setTimeout(() => flush.current(), 500)
    return () => clearTimeout(timer)
  }, [project, ready])
  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') flush.current() }
    const leave = () => flush.current()
    window.addEventListener('pagehide', leave)
    document.addEventListener('visibilitychange', hide)
    return () => { window.removeEventListener('pagehide', leave); document.removeEventListener('visibilitychange', hide) }
  }, [])
  return { ready, status, error }
}
