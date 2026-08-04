# Виииз

Браузерный редактор визуализаций: импорт CSV/XLSX/Parquet/публичных Google Sheets, настройка сравнительных, трендовых, иерархических, матричных и распределительных графиков, экспорт PNG/SVG.

## Запуск

```bash
export PATH="$HOME/.local/node-v24.18.0/bin:$PATH"
npm install
npm run dev
```

## Архитектура

- `src/core/importers.ts` — адаптеры источников данных.
- `src/entities/chart/model` — `ChartDocument`, семейные chart specs, semantic scene elements, стабильные IDs и legacy-config adapters.
- `src/features/chart-layout` — геометрия, semantic spacing, reservations, frame/axis/text/guide contracts.
- `src/features/chart-types` — каталог и постепенно выделяемые компиляторы семейств графиков.
- `src/features/chart-renderer/echarts` — адаптер semantic scene в ECharts с динамической загрузкой модулей.
- `src/components/ChartCanvas.tsx` — orchestration рендера, feedback lifecycle и editor overlays.
- `src/features/chart-export` — PNG/SVG serialization и embedding шрифтов.
- `src/core/chartRegistry.ts` — переходный реестр/dispatch; старый `buildOption` сохранён как deprecated compatibility boundary до завершения миграции семейств.

Поток рендера: editor config → `ChartDocument` → `ChartPlugin.compile` → `ChartScene` → layout/renderer. Обычные bar/stacked/horizontal-bar, basic line/spline/step-line, area/stacked-area, indexed/seasonal trends, Slope, smoothing и interval-графики используют native semantic scene. Slope имеет отдельный comparison-layout; Range/Step Range/Confidence используют общий Cartesian layout, реальные source-series и отдельные неинтерактивные semantic band cells. Остальные специализированные семейства явно остаются на legacy compatibility path. Новый график добавляется семантическим plugin compiler и регистрацией в `chartRegistry`; UI выбора строится из реестра и semantic capabilities.
