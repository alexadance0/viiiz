import { useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { BrandLogo } from '../../../components/BrandLogo'
import type { ChartExportOptions } from '../../chart-export/chartExport'

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
    <div className="editor-nav"><Link className="close-editor" to="/" aria-label="Выйти из редактора" title="Выйти из редактора"><X size={18}/></Link><Link className="brand" to="/" aria-label="виииз — главная"><BrandLogo decorative/></Link></div>
    <div className="project-name"><span className="status-dot" /><span><strong>{projectName}</strong><small>{projectMeta}</small></span></div>
    <div className="export-actions">{canExport && <details className="export-menu"><summary className="button primary">Экспорт</summary><div><label>Имя файла<input value={filename} onChange={(event) => setFilename(event.target.value.replace(/[\\/:*?"<>|]/g, '-'))}/></label><label>Масштаб<select value={scale} onChange={(event) => setScale(Number(event.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option></select></label><div><button className="button subtle" onClick={() => onExportSvg(options)}>Скачать SVG</button><button className="button primary" onClick={() => onExportPng(options)}>Скачать PNG</button></div><small>Шрифты и размеры холста сохраняются в экспортируемом файле.</small></div></details>}</div>
  </header>
}
