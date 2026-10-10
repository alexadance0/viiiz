import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, Plus, Upload, X } from 'lucide-react'
import type { ChartConfig, DataTable } from '../core/types'
import { applyTemplate, applyTemplateToComposition, builtInTemplates, createTemplate, createCompositionTemplate, templateAppearanceSignature, MAX_TEMPLATE_BYTES, parseTemplate, type ChartTemplate } from '../features/chart-templates/templates'
import { deleteTemplate, loadTemplates, saveTemplate } from '../features/chart-templates/storage'
import { prepareChartData } from '../core/chartData'
import { TemplateThumbnail } from './TemplateThumbnail'
import { MultiplesCanvas } from '../features/editor/ui/MultiplesCanvas'
import './ChartTemplates.css'

const ChartCanvas = lazy(() => import('./ChartCanvas').then((module) => ({ default: module.ChartCanvas })))
function orderedSeriesNames(table: DataTable, config: ChartConfig) {
  const names = prepareChartData(table, config).series.map((series) => series.name)
  if (!config.seriesOrder?.length) return names
  const positions = new Map(config.seriesOrder.map((name, index) => [name, index]))
  return names.toSorted((a, b) => (positions.get(a) ?? names.length) - (positions.get(b) ?? names.length))
}



type TemplateScope = 'composition' | 'chart'
interface Props { config: ChartConfig; table: DataTable; seriesNames: string[]; documentConfig?: ChartConfig; selectedPanel?: number | null; onApplyDocument?(config: ChartConfig): void; onApply(config: ChartConfig): void }
interface AppliedTemplate { template: ChartTemplate; signature: string; scope: TemplateScope }
export function ChartTemplates(props: Props) {
  const [open, setOpen] = useState(false)
  const [launch, setLaunch] = useState<{ template: ChartTemplate; view: 'create' | 'update'; scope: TemplateScope } | null>(null)
  const [applied, setApplied] = useState<Record<string, AppliedTemplate>>({})
  const trigger = useRef<HTMLButtonElement>(null)
  const composition = props.documentConfig?.multiples ? props.documentConfig : undefined
  const panel = composition && props.selectedPanel != null ? composition.multiples!.panels[props.selectedPanel] : undefined
  const key = panel ? panel.id : composition ? 'composition' : 'chart'
  const current = applied[key] ?? (panel ? applied.composition : undefined)
  const currentConfig = current?.scope === 'composition' && composition ? composition : props.config
  const namesFor = (config: ChartConfig) => config === props.config ? props.seriesNames : orderedSeriesNames(props.table, config)
  const modified = current && current.signature !== templateAppearanceSignature(currentConfig, current.template.includeSize, namesFor)
  const close = () => { setOpen(false); setLaunch(null); requestAnimationFrame(() => trigger.current?.focus()) }
  const appliedTemplate = (template: ChartTemplate, scope: TemplateScope, config: ChartConfig) => {
    if (scope === 'composition') props.onApplyDocument?.(config)
    else props.onApply(config)
    const targetKey = scope === 'composition' ? 'composition' : key
    setApplied((items) => ({ ...(scope === 'composition' ? {} : items), [targetKey]: { template, scope, signature: templateAppearanceSignature(config, template.includeSize, namesFor) } }))
  }
  return <><button ref={trigger} type="button" className="template-library-trigger" title="Сохранить или применить оформление" onClick={() => setOpen(true)}><Bookmark size={16}/>Шаблоны</button>
    {current && <div className="template-applied"><span>Шаблон: <strong>{current.template.name}</strong>{modified && <small>Оформление изменено</small>}</span><button type="button" onClick={() => { setLaunch({ template: current.template, view: current.template.id.startsWith('builtin:') ? 'create' : 'update', scope: current.scope }); setOpen(true) }}>{current.template.id.startsWith('builtin:') ? 'Сохранить свой шаблон' : 'Обновить из текущего оформления'}</button></div>}
    {open && <TemplateDialog {...props} launch={launch} onApplied={appliedTemplate} onSaved={(template, scope, updated) => setApplied((items) => Object.fromEntries(Object.entries(items).map(([id, item]) => [id, item.template.id === template.id ? { ...item, template, ...(updated && id === (scope === 'composition' ? 'composition' : key) ? { signature: templateAppearanceSignature(updated, template.includeSize, namesFor) } : {}) } : item])))} onRemoved={(id) => setApplied((items) => Object.fromEntries(Object.entries(items).filter(([, item]) => item.template.id !== id)))} onClose={close}/>}</>
}

function TemplateDialog({ config, table, seriesNames, documentConfig, selectedPanel, launch, onApplied, onSaved, onRemoved, onClose }: Props & { launch: { template: ChartTemplate; view: 'create' | 'update'; scope: TemplateScope } | null; onApplied(template: ChartTemplate, scope: TemplateScope, config: ChartConfig): void; onSaved(template: ChartTemplate, scope: TemplateScope, updated?: ChartConfig): void; onRemoved(id: string): void; onClose(): void }) {
  const composition = documentConfig?.multiples ? documentConfig : undefined
  const [scope, setScope] = useState<TemplateScope>(launch?.scope ?? (composition && selectedPanel == null ? 'composition' : 'chart'))
  const source = scope === 'composition' && composition ? composition : config
  const namesFor = (value: ChartConfig) => value === config ? seriesNames : orderedSeriesNames(table, value)
  const capture = (name: string, size: boolean) => scope === 'composition' && composition ? createCompositionTemplate(source, name, size, namesFor) : createTemplate(source, name, size, namesFor(source))
  const apply = (template: ChartTemplate, size: boolean) => scope === 'composition' && composition ? applyTemplateToComposition(source, template, namesFor, size) : applyTemplate(source, template, namesFor(source), size)
  const dialog = useRef<HTMLDialogElement>(null), importInput = useRef<HTMLInputElement>(null)
  const [mine, setMine] = useState<ChartTemplate[]>([])
  const [tab, setTab] = useState<'ready' | 'mine'>(launch && !launch.template.id.startsWith('builtin:') ? 'mine' : 'ready')
  const [selectedId, setSelectedId] = useState(launch?.template.id ?? builtInTemplates[0].id)
  const [view, setView] = useState<'library' | 'create' | 'rename' | 'update' | 'delete'>(launch?.view ?? 'library')
  const [name, setName] = useState(launch?.view === 'create' ? `${launch.template.name} — свой вариант` : '')
  const [includeSize, setIncludeSize] = useState(launch?.template.includeSize ?? false)
  const [applySize, setApplySize] = useState(true)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  useEffect(() => {
    dialog.current?.showModal()
    let active = true
    loadTemplates().then((items) => { if (active) setMine(items) }).catch(() => { if (active) setError('Не удалось открыть хранилище шаблонов в этом браузере.') }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [])
  const selected = [...builtInTemplates, ...mine].find((item) => item.id === selectedId) ?? (launch?.template.id === selectedId ? launch.template : undefined)
  const own = selected && !selected.id.startsWith('builtin:')
  const previewConfig = view === 'create' || view === 'update' || !selected ? source : apply(selected, applySize)
  const preview = useMemo(() => ({ ...previewConfig, autoFitCanvas: true }), [previewConfig])
  const list = (tab === 'ready' ? builtInTemplates : mine).toSorted((a, b) => Number(b.variants?.some((variant) => variant.sourceKind === source.kind) || b.sourceKind === source.kind) - Number(a.variants?.some((variant) => variant.sourceKind === source.kind) || a.sourceKind === source.kind))
  const select = (template: ChartTemplate) => { setSelectedId(template.id); setApplySize(true); setError(''); setStatus('') }
  const chooseTab = (next: 'ready' | 'mine') => { setTab(next); setSelectedId(next === 'ready' ? builtInTemplates[0].id : mine[0]?.id ?? ''); setApplySize(true) }
  const startCreate = () => { setName('Моё оформление'); setIncludeSize(false); setView('create'); setError(''); setStatus('') }
  const persist = async (template: ChartTemplate, updated?: ChartConfig) => {
    setBusy(true); setError('')
    try {
      await saveTemplate(template)
      onSaved(template, scope, updated)
      setMine((items) => [template, ...items.filter((item) => item.id !== template.id)])
      setTab('mine'); select(template); setView('library'); setStatus('Шаблон сохранён в этом браузере.')
    } catch { setError('Не удалось сохранить шаблон. Проверьте доступность хранилища и свободное место. Вы можете скачать файл шаблона.') }
    finally { setBusy(false) }
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      if (view === 'rename' && selected) await persist(parseTemplate({ ...selected, name: name.trim(), updatedAt: new Date().toISOString() }))
      else {
        const template = capture(view === 'update' ? selected!.name : name.trim(), includeSize)
        await persist(view === 'update' && selected ? { ...template, id: selected.id, createdAt: selected.createdAt } : template, view === 'update' ? source : undefined)
      }
    } catch { setError('Не удалось создать шаблон из этих настроек. Проверьте название и параметры оформления.') }
  }
  const download = (template: ChartTemplate) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${template.name.replace(/[<>:"/\\|?*]/g, '_')}.viiiz-template`; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const importFile = async (file?: File) => {
    if (!file) return
    setError('')
    try {
      if (file.size > MAX_TEMPLATE_BYTES) throw new Error('size')
      const template = parseTemplate(JSON.parse(await file.text()))
      await persist({ ...template, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    } catch { setError('Не удалось открыть файл. Выберите шаблон Виииз версии 1 размером до 16 МБ.') }
    if (importInput.current) importInput.current.value = ''
  }
  const remove = async () => {
    if (!selected) return
    setBusy(true); setError('')
    try { await deleteTemplate(selected.id); onRemoved(selected.id); setMine((items) => items.filter((item) => item.id !== selected.id)); setSelectedId(''); setView('library'); setStatus('Шаблон удалён.') }
    catch { setError('Не удалось удалить шаблон. Повторите попытку.') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="template-dialog" aria-labelledby="template-dialog-title" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose() } }}>
    <header><div><h2 id="template-dialog-title">{view === 'create' ? 'Создать шаблон' : view === 'update' ? 'Обновить шаблон' : view === 'rename' ? 'Переименовать шаблон' : view === 'delete' ? 'Удалить шаблон?' : 'Шаблоны оформления'}</h2><p>{view === 'library' ? 'Сохраните свой стиль или примените готовый к текущему графику.' : 'Цвета, шрифты и оформление — для следующих графиков.'}</p></div><button type="button" className="template-close" aria-label="Закрыть шаблоны" onClick={onClose}><X size={20}/></button></header>
    {error && <p className="template-message error" role="alert">{error}</p>}{status && <p className="template-message" role="status">{status}</p>}
    {composition && <div className="template-scope"><label>{view === 'create' ? 'Создать из' : view === 'update' ? 'Обновить из' : 'Применить к'}<select value={scope} onChange={(event) => setScope(event.target.value as TemplateScope)}><option value="composition">Всей композиции</option><option value="chart" disabled={selectedPanel == null}>{view === 'create' || view === 'update' ? 'Выбранного графика' : 'Выбранному графику'}</option></select></label></div>}
    <div className="template-dialog-body">
      <section className="template-library" aria-label="Библиотека шаблонов">
        {view === 'library' ? <>
          <div className="template-tabs" role="tablist" aria-label="Источник шаблонов">{([['ready', 'Готовые'], ['mine', 'Мои']] as const).map(([key, label]) => <button key={key} type="button" role="tab" tabIndex={tab === key ? 0 : -1} aria-selected={tab === key} aria-controls="template-list" id={`template-tab-${key}`} onClick={() => chooseTab(key)} onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const next = event.key === 'Home' ? 'ready' : event.key === 'End' ? 'mine' : key === 'ready' ? 'mine' : 'ready'
            chooseTab(next); dialog.current?.querySelector<HTMLButtonElement>(`#template-tab-${next}`)?.focus()
          }}>{label}</button>)}</div>
          <div className="template-library-actions"><button type="button" className="button" disabled={busy} onClick={startCreate}><Plus size={15}/>Сохранить текущее оформление…</button><button type="button" className="button" disabled={busy} onClick={() => importInput.current?.click()}><Upload size={15}/>Загрузить файл</button></div>
          <input ref={importInput} className="template-file-input" type="file" accept=".viiiz-template,.json,application/json" aria-label="Файл шаблона" onChange={(event) => void importFile(event.target.files?.[0])}/>
          {tab === 'mine' && <p className="template-storage-note">Сохранены в этом браузере. Скачайте файл для переноса или резервной копии.</p>}
          <div id="template-list" role="tabpanel" aria-labelledby={`template-tab-${tab}`} className="template-list">
            {busy && !mine.length && <p role="status">Открываем хранилище…</p>}
            {!busy && !list.length && <div className="template-empty"><h3>Ваше оформление можно сохранить</h3><p>Настройте график и создайте шаблон для следующих работ.</p><button type="button" className="button" onClick={startCreate}>Создать первый шаблон</button></div>}
            {list.map((template) => <button type="button" key={template.id} className={`template-card${selectedId === template.id ? ' selected' : ''}`} aria-pressed={selectedId === template.id} aria-label={template.name} onClick={() => select(template)}><TemplateThumbnail template={template}/><strong>{template.name}</strong><small>{template.variants?.length ? 'Шаблон композиции' : 'Оформление графика'}{template.includeSize ? ' · размер холста' : ''}</small></button>)}
          </div>
        </> : view === 'delete' ? <><p>«{selected?.name}» исчезнет из библиотеки. Оформление текущего графика сохранится.</p><div className="template-form-actions"><button type="button" className="button" disabled={busy} onClick={() => setView('library')}>Отмена</button><button type="button" className="button primary" disabled={busy} onClick={() => void remove()}>Удалить шаблон</button></div></> : <form onSubmit={(event) => void save(event)}>
          {view !== 'update' && <label>Название шаблона<input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)}/></label>}
          {view !== 'rename' && <><label className="template-check"><input type="checkbox" checked={includeSize} onChange={(event) => setIncludeSize(event.target.checked)}/>Сохранить также размер холста</label><p>Сохраняются цвета, шрифты и настройки оформления. Данные, тексты, аннотации и шкалы остаются в проекте.</p>{scope === 'composition' && <p>Оформление каждого типа берётся из первого графика этого типа. Сетка не сохраняется в шаблон.</p>}</>}
          {view === 'update' && selected && <div className="template-comparison"><div><span>Было</span><TemplateThumbnail template={selected}/></div><div><span>Станет</span><TemplateThumbnail template={capture(selected.name, includeSize)}/></div></div>}
          <div className="template-form-actions"><button type="button" className="button" disabled={busy} onClick={() => { setView('library'); setError('') }}>Отмена</button><button type="submit" className="button primary" disabled={busy || view !== 'update' && !name.trim()}>{busy ? 'Сохраняем…' : view === 'create' ? 'Создать шаблон' : view === 'update' ? 'Обновить шаблон' : 'Сохранить название'}</button></div>
          {(view === 'create' || view === 'update') && error && <button type="button" className="button" onClick={() => { try { download(capture(view === 'update' ? selected!.name : name.trim() || 'Моё оформление', includeSize)) } catch { setError('Не удалось подготовить файл шаблона.') } }}>Скачать файл шаблона</button>}
        </form>}
      </section>
      <section className="template-preview" aria-label="Предпросмотр оформления">
        <div className="template-preview-header"><div><h3>{view === 'create' || view === 'update' ? 'Текущее оформление' : selected?.name ?? 'Ваш график'}</h3><p>Предпросмотр на ваших данных</p></div>{view === 'library' && selected && <details key={selected.id} className="template-menu"><summary>Действия</summary><div>{own && <><button type="button" disabled={busy} onClick={() => { setName(selected.name); setView('rename') }}>Переименовать</button><button type="button" disabled={busy} onClick={() => { setIncludeSize(selected.includeSize); setView('update') }}>Обновить из текущего графика…</button></>}<button type="button" disabled={busy} onClick={() => void persist({ ...selected, id: crypto.randomUUID(), name: `${selected.name.slice(0, 68)} — копия`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })}>Сохранить копию</button><button type="button" onClick={() => download(selected)}>Скачать</button>{own && <button type="button" disabled={busy} onClick={() => setView('delete')}>Удалить…</button>}</div></details>}</div>
        <div className="template-chart-preview"><Suspense fallback={<p role="status">Готовим предпросмотр…</p>}>{preview.multiples && scope === 'composition' ? <MultiplesCanvas table={table} config={preview} selected={null} zoom={1} onSelect={() => {}} onAdd={() => {}} renderPanel={(panel, ref) => <ChartCanvas ref={ref} table={table} config={panel} disableViewGestures/>}/> : <ChartCanvas table={table} config={preview} disableViewGestures/>}</Suspense></div>
        {view === 'library' && selected && <footer>{selected.includeSize && <label className="template-check"><input type="checkbox" checked={applySize} onChange={(event) => setApplySize(event.target.checked)}/>Применить также размер холста ({selected.style.canvasWidth} × {selected.style.canvasHeight} px)</label>}<div className="template-form-actions"><button type="button" className="button" onClick={onClose}>Отмена</button><button type="button" className="button primary" disabled={busy} onClick={() => { onApplied(selected, scope, apply(selected, applySize)); onClose() }}>Применить</button></div></footer>}
      </section>
    </div>
  </dialog>
}
