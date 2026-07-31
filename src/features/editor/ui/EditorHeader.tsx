import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ChartExportOptions } from '../../chart-export/chartExport'
import { APP_NAME } from '../../../shared/config/app'

interface Props {
  projectName: string
  projectMeta: string
  canExport: boolean
  onExportSvg(options: ChartExportOptions): void
  onExportPng(options: ChartExportOptions): void
}

export function EditorHeader({ projectName, projectMeta, canExport, onExportSvg, onExportPng }: Props) {
  const [filename, setFilename] = useState('chart')
  const [scale, setScale] = useState(2)
  const options = { filename, scale }
  return <header className="topbar">
    <Link className="brand" to="/"><span className="brand-mark">В</span><span>{APP_NAME}</span></Link>
    <div className="project-name"><span className="status-dot" />{projectName}<small>{projectMeta}</small></div>
    <div className="export-actions">{canExport && <details className="export-menu"><summary className="button primary">Экспорт</summary><div><label>Имя файла<input value={filename} onChange={(event) => setFilename(event.target.value.replace(/[\\/:*?"<>|]/g, '-'))}/></label><label>Масштаб<select value={scale} onChange={(event) => setScale(Number(event.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option></select></label><div><button className="button subtle" onClick={() => onExportSvg(options)}>Скачать SVG</button><button className="button primary" onClick={() => onExportPng(options)}>Скачать PNG</button></div><small>Шрифты и размеры холста сохраняются в экспортируемом файле.</small></div></details>}<Link className="close-editor" to="/projects">×</Link></div>
  </header>
}
