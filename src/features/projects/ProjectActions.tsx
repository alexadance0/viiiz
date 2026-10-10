import { useRef } from 'react'
import './ProjectActions.css'

interface Props {
  canSave: boolean
  busy: boolean
  status: string
  onSave(): void
  onOpen(file: File): void
}

export function ProjectActions({ canSave, busy, status, onSave, onOpen }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const menu = useRef<HTMLDetailsElement>(null)
  return <>
    <input ref={input} type="file" hidden accept=".viiiz,application/json" aria-label="Открыть файл проекта" disabled={busy} onChange={(event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) onOpen(file)
    }}/>
    <details ref={menu} className="project-menu">
      <summary className="button">Проект</summary>
      <div className="project-menu-panel">
        <button type="button" disabled={busy} onClick={() => { menu.current!.open = false; input.current?.click() }}>Открыть проект…</button>
        <button type="button" disabled={!canSave || busy} onClick={() => { menu.current!.open = false; onSave() }}>Скачать проект</button>
        <p role="status" aria-live="polite">{canSave ? status : 'Добавьте данные, чтобы сохранить проект.'}</p>
        <small>Автосохранение — в этом браузере. Скачайте проект, чтобы перенести его на другое устройство.</small>
      </div>
    </details>
  </>
}
