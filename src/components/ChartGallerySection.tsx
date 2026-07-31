import type { CSSProperties } from 'react'
import './ChartGallerySection.css'

type PreviewKind = 'bar' | 'line' | 'area' | 'scatter' | 'lollipop' | 'heatmap' | 'bubble' | 'slope' | 'boxplot'
type Preview = { title: string; note: string; kind: PreviewKind; color: string; image: string }

const columns: Preview[][] = [
  [
    { title: 'Столбчатый', note: 'Сравнение категорий', kind: 'bar', color: '#18aeda', image: '/chart-gallery/01.png' },
    { title: 'Линейный', note: 'Динамика во времени', kind: 'line', color: '#6956e8', image: '/chart-gallery/02.png' },
    { title: 'Точечный', note: 'Связь показателей', kind: 'scatter', color: '#e033ab', image: '/chart-gallery/03.png' },
    { title: 'Lollipop', note: 'Компактное сравнение', kind: 'lollipop', color: '#4568e1', image: '/chart-gallery/04.png' },
    { title: 'Тепловая карта', note: 'Плотность значений', kind: 'heatmap', color: '#845be8', image: '/chart-gallery/05.png' },
  ],
  [
    { title: 'Областной', note: 'Изменение объёма', kind: 'area', color: '#e033ab', image: '/chart-gallery/06.png' },
    { title: 'Пузырьковый', note: 'Три измерения', kind: 'bubble', color: '#18aeda', image: '/chart-gallery/07.png' },
    { title: 'Slope chart', note: 'Изменение между точками', kind: 'slope', color: '#4568e1', image: '/chart-gallery/08.png' },
    { title: 'Box plot', note: 'Распределение данных', kind: 'boxplot', color: '#845be8', image: '/chart-gallery/09.png' },
    { title: 'С накоплением', note: 'Структура целого', kind: 'bar', color: '#6956e8', image: '/chart-gallery/10.png' },
  ],
  [
    { title: 'Bubble chart', note: 'Масштаб и положение', kind: 'bubble', color: '#845be8', image: '/chart-gallery/11.png' },
    { title: 'Диапазоны', note: 'Минимум и максимум', kind: 'area', color: '#18aeda', image: '/chart-gallery/12.png' },
    { title: 'Beeswarm', note: 'Каждое наблюдение', kind: 'scatter', color: '#4568e1', image: '/chart-gallery/13.png' },
    { title: 'Ступенчатый', note: 'Дискретные изменения', kind: 'line', color: '#e033ab', image: '/chart-gallery/14.png' },
    { title: 'Горизонтальный', note: 'Длинные подписи', kind: 'lollipop', color: '#6956e8', image: '/chart-gallery/15.png' },
  ],
]

export function ChartGallerySection() {
  return (
    <section className="chart-gallery-section" id="chart-types" aria-labelledby="chart-gallery-title">
      <div className="chart-gallery-columns">
        {columns.map((items, columnIndex) => (
          <div className={`chart-marquee ${columnIndex === 1 ? 'is-reverse' : ''}`} key={columnIndex}>
            <div className="chart-marquee-track" style={{ '--gallery-duration': `${32 + columnIndex * 4}s` } as CSSProperties}>
              {[0, 1].map((copy) => (
                <div className="chart-marquee-group" aria-hidden={copy === 1} key={copy}>
                  {items.map((item) => <ChartPreview {...item} key={`${copy}-${item.title}`} />)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="chart-gallery-copy">
        <h2 id="chart-gallery-title">
          <span className="chart-gallery-title-line" data-mask="Найдётся график">Найдётся график</span><br/>
          <span className="chart-gallery-title-line" data-mask="для любой истории">для любой истории</span>
        </h2>
        <p data-mask="От точного сравнения до сложного распределения — выберите форму, которая лучше всего раскрывает ваши данные.">От точного сравнения до сложного распределения — выберите форму, которая лучше всего раскрывает ваши данные.</p>
      </div>
    </section>
  )
}

function ChartPreview({ title, note, kind, color, image }: Preview) {
  return (
    <figure className="chart-gallery-card" style={{ '--chart-color': color } as CSSProperties}>
      <div className="chart-gallery-art">
        <ChartArt kind={kind}/>
        <img src={image} alt="" onError={(event) => { event.currentTarget.hidden = true }}/>
      </div>
      <figcaption><strong>{title}</strong><span>{note}</span></figcaption>
    </figure>
  )
}

function ChartArt({ kind }: { kind: PreviewKind }) {
  if (kind === 'bar') return <svg viewBox="0 0 240 130"><g className="grid"><path d="M18 25H228M18 65H228M18 105H228"/></g><g className="fill"><rect x="35" y="69" width="24" height="36"/><rect x="72" y="43" width="24" height="62"/><rect x="109" y="57" width="24" height="48"/><rect x="146" y="24" width="24" height="81"/><rect x="183" y="48" width="24" height="57"/></g></svg>
  if (kind === 'line') return <svg viewBox="0 0 240 130"><g className="grid"><path d="M18 25H228M18 65H228M18 105H228"/></g><path className="stroke" d="M20 98 53 73 87 80 121 42 155 55 190 22 224 35"/><g className="fill dots"><circle cx="20" cy="98" r="4"/><circle cx="53" cy="73" r="4"/><circle cx="87" cy="80" r="4"/><circle cx="121" cy="42" r="4"/><circle cx="155" cy="55" r="4"/><circle cx="190" cy="22" r="4"/><circle cx="224" cy="35" r="4"/></g></svg>
  if (kind === 'area') return <svg viewBox="0 0 240 130"><g className="grid"><path d="M18 25H228M18 65H228M18 105H228"/></g><path className="area" d="M18 102 52 82 86 88 120 48 154 61 190 29 224 42V106H18Z"/><path className="stroke" d="M18 102 52 82 86 88 120 48 154 61 190 29 224 42"/></svg>
  if (kind === 'scatter') return <svg viewBox="0 0 240 130"><g className="grid"><path d="M18 25H228M18 65H228M18 105H228"/></g><g className="fill"><circle cx="38" cy="94" r="5"/><circle cx="63" cy="76" r="4"/><circle cx="86" cy="85" r="6"/><circle cx="112" cy="59" r="5"/><circle cx="139" cy="66" r="4"/><circle cx="165" cy="39" r="6"/><circle cx="192" cy="44" r="4"/><circle cx="215" cy="25" r="5"/></g><path className="trend" d="M30 101 219 20"/></svg>
  if (kind === 'lollipop') return <svg viewBox="0 0 240 130"><g className="grid"><path d="M18 25H228M18 65H228M18 105H228"/></g><g className="lollipop"><path d="M43 105V72M82 105V47M121 105V64M160 105V30M199 105V52"/><circle cx="43" cy="72" r="7"/><circle cx="82" cy="47" r="7"/><circle cx="121" cy="64" r="7"/><circle cx="160" cy="30" r="7"/><circle cx="199" cy="52" r="7"/></g></svg>
  if (kind === 'heatmap') return <svg viewBox="0 0 240 130"><g className="heatmap">{[0,1,2,3,4,5].flatMap((row) => [0,1,2,3,4,5,6,7,8].map((column) => <rect x={18 + column * 23} y={10 + row * 19} width="18" height="14" opacity={0.18 + ((row * 7 + column * 3) % 8) * 0.1} key={`${row}-${column}`}/>))}</g></svg>
  if (kind === 'bubble') return <svg viewBox="0 0 240 130"><g className="grid"><path d="M18 25H228M18 65H228M18 105H228"/></g><g className="bubble"><circle cx="48" cy="88" r="13"/><circle cx="86" cy="61" r="20"/><circle cx="131" cy="78" r="10"/><circle cx="164" cy="40" r="26"/><circle cx="209" cy="57" r="16"/></g></svg>
  if (kind === 'slope') return <svg viewBox="0 0 240 130"><g className="slope"><path d="M35 90 205 29M35 42 205 67M35 72 205 93"/><circle cx="35" cy="90" r="5"/><circle cx="205" cy="29" r="5"/><circle cx="35" cy="42" r="5"/><circle cx="205" cy="67" r="5"/><circle cx="35" cy="72" r="5"/><circle cx="205" cy="93" r="5"/></g></svg>
  return <svg viewBox="0 0 240 130"><g className="grid"><path d="M18 25H228M18 65H228M18 105H228"/></g><g className="boxplot"><path d="M35 63H205M58 52V74M182 52V74"/><rect x="88" y="42" width="62" height="42"/><path d="M118 42V84"/></g></svg>
}
