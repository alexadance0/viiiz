# DataCanvas

Локальный MVP редактора визуализаций: импорт CSV/XLSX/Parquet/публичных Google Sheets, настройка bar/line/scatter и экспорт PNG/SVG.

## Запуск

```bash
export PATH="$HOME/.local/node-v24.18.0/bin:$PATH"
npm install
npm run dev
```

## Архитектура

- `src/core/importers.ts` — адаптеры источников данных.
- `src/core/chartRegistry.ts` — реестр подключаемых типов графиков.
- `src/core/types.ts` — стабильные контракты между данными, редактором и визуализациями.
- `src/components/ChartCanvas.tsx` — рендер SVG и экспорт.

Новый график добавляется реализацией `ChartPlugin` и регистрацией в `chartRegistry`; UI выбора строится из реестра автоматически.
