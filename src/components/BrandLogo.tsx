import { useId } from 'react'
import { APP_NAME } from '../shared/config/app'
import { SYMBOL_GRID } from './symbolGrid'
import './BrandLogo.css'

interface Props {
  className?: string
  decorative?: boolean
  variant?: 'compact' | 'animated' | 'expanded' | 'mark' | 'upcoming'
}

export function BrandLogo({ className = '', decorative = false, variant = 'compact' }: Props) {
  const viewBox = variant === 'upcoming' ? '0 16 1788 900' : variant === 'mark' ? '640 158 890 386' : variant === 'compact' ? '0 0 2172 724' : '-160 0 2520 724'
  const clipId = useId().replaceAll(':', '')

  return (
    <svg className={`brand-logo brand-logo--${variant} ${className}`.trim()} viewBox={viewBox} shapeRendering="geometricPrecision" role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : variant === 'upcoming' ? 'вииииз' : APP_NAME.toLocaleLowerCase('ru-RU')}>
      <defs>
        <clipPath id={`${clipId}-i-1`}><rect x="640" y="158" width="440" height="386" /></clipPath>
        <clipPath id={`${clipId}-i-2`}><rect x="865" y="158" width="440" height="386" /></clipPath>
        <clipPath id={`${clipId}-i-3`}><rect x="1090" y="158" width="440" height="386" /></clipPath>
        {variant === 'upcoming' && <>
          <clipPath id={`${clipId}-pixel-fill`}>
            <path d="M620 162.18 693 74.42V479.89L871 265.89V762.82L798 850.58V457.11L620 671.11Z" />
            <path transform="translate(314 0)" d="M620 162.18 693 74.42V479.89L871 265.89V762.82L798 850.58V457.11L620 671.11Z" />
          </clipPath>
          <mask id={`${clipId}-guide-lower`} maskUnits="userSpaceOnUse" x="580" y="140" width="240" height="760">
            <g fill="none" stroke="white" strokeWidth="60" strokeLinecap="square" strokeLinejoin="miter">
              <path className="brand-logo-guide-draw brand-logo-guide-vertical" d="M611 162V696" pathLength="1" />
              <path className="brand-logo-guide-draw brand-logo-guide-vertical" d="M789 873V482" pathLength="1" />
              <path className="brand-logo-guide-draw brand-logo-guide-diagonal" d="M451 888.36L789 482" pathLength="1" />
            </g>
          </mask>
          <mask id={`${clipId}-guide-upper`} maskUnits="userSpaceOnUse" x="670" y="30" width="240" height="760">
            <g fill="none" stroke="white" strokeWidth="60" strokeLinecap="square" strokeLinejoin="miter">
              <path className="brand-logo-guide-draw brand-logo-guide-vertical" d="M702 52V455" pathLength="1" />
              <path className="brand-logo-guide-draw brand-logo-guide-vertical" d="M880 764V241" pathLength="1" />
              <path className="brand-logo-guide-draw brand-logo-guide-diagonal" d="M1040 48.64L702 455" pathLength="1" />
            </g>
          </mask>
        </>}
      </defs>
      <g className={variant === 'upcoming' ? 'brand-logo-upcoming-edges' : undefined} transform={variant === 'upcoming' ? 'translate(-8 684) scale(.058 -.058)' : 'translate(0 724) scale(.1 -.1)'} fill="currentColor">
        <path className="brand-logo-edge brand-logo-edge-start" d="M900 3730v-1930h1535c1034 0 1568 4 1633 11 305 34 596 129 816 267 123 77 201 146 288 252 294 361 287 866-16 1189-117 123-317 243-514 306-50 17-92 32-92 35s37 24 83 47c186 92 320 221 402 388 60 122 78 203 77 345-3 470-347 825-934 965-230 54-249 55-1825 55H900V3730Zm2610 999c136-31 210-76 258-157 24-41 27-57 27-132s-3-91-30-138c-48-87-110-129-242-163-72-18-116-19-734-19h-657l-3 78c-2 43-2 183 0 310l3 231 92 3c225 7 1244-3 1286-13Zm21-1419c105-10 176-32 259-82 44-27 60-44 84-92 26-49 30-70 30-130 0-151-83-243-264-293-60-17-124-18-785-18h-720l-3 300c-1 165 0 305 3 312 3 10 140 13 652 13 356 0 691-5 744-10Z" />
        {variant === 'compact' ? <g className="brand-logo-source-mark">
          <g className="brand-logo-source-letter">
            <path className="brand-logo-source-part" d="M5730 3730v-1930h788l787 1 100 111c55 62 183 202 285 312 211 228 438 476 524 574 32 37 147 162 255 278 108 117 275 299 371 405 96 106 207 227 245 269 167 180 393 428 565 620 232 259 310 345 485 534 77 84 219 240 315 346 96 107 207 229 246 271 39 42 81 91 93 108l22 31h-819l-819 0-184-202c-199-218-233-256-414-458-66-74-169-189-230-256-60-66-159-177-220-244-60-68-159-178-219-244-60-67-143-159-186-206-42-47-188-211-325-365-136-154-279-313-317-354l-68-73-2 638c-2 352-1 892 1 1202l3 562h-641l-641 0V3730Z" />
            <rect className="brand-logo-source-stem" x="9361" y="1800" width="1450" height="3860" />
          </g>
          <g className="brand-logo-source-letter">
            <rect className="brand-logo-source-stem" x="8038" y="1800" width="1450" height="3860" />
            <path className="brand-logo-source-part" d="M11503 5646c-8-14-150-172-368-411-185-202-543-600-630-700-43-49-106-119-139-155-34-36-113-124-176-195-112-126-199-222-480-530-74-81-160-176-190-210-30-34-141-156-245-271-105-115-282-312-394-439-113-126-236-264-275-305-63-67-246-270-485-537l-83-93h850l851 0 58 69c32 39 168 193 303 344 135 151 286 321 335 378 50 57 101 115 115 130 14 14 52 57 85 95 99 114 304 345 364 409 31 34 135 150 231 260 96 109 249 283 340 385 91 103 210 237 265 300 55 63 154 174 220 248 66 73 138 156 160 182 42 52 123 142 270 305 90 99 496 559 608 688l59 67h-821c-686 0-821-2-828-14Z" />
            <rect className="brand-logo-source-stem" x="11702" y="1800" width="1450" height="3860" />
          </g>
          <g className="brand-logo-source-letter">
            <rect className="brand-logo-source-stem" x="10420" y="1800" width="1450" height="3860" />
            <path className="brand-logo-source-part" d="M13843 5583c-37-43-120-135-183-204-63-69-196-215-295-324-99-109-234-257-300-329-66-73-221-244-345-381-124-137-252-279-285-315-33-36-100-110-150-164-49-55-146-161-215-235-69-75-139-152-155-172-17-20-88-99-160-176-161-173-331-360-641-704-131-146-320-354-419-463-99-108-201-223-228-254l-47-57 827-3 828-2 40 47c22 27 87 100 145 164 58 64 152 169 210 235 58 65 132 148 166 184 33 36 137 151 230 255 93 105 243 274 334 375 91 101 212 237 270 301 58 65 184 204 281 311 346 380 433 477 579 643 206 234 325 365 332 365 4 0 8-648 8-1440V1800h725l724 0 1 1930V5660h-1104l-1104 0-69-77Z" />
          </g>
        </g> : null}
        <path className="brand-logo-edge brand-logo-edge-end" d="M18350 5719c-545-32-955-137-1317-339-238-134-400-268-611-508l-56-64 24-19c21-16 329-236 599-429 43-30 123-88 178-127 55-40 104-73 109-73 6 0 36 27 69 61 89 91 317 258 426 312 194 96 327 140 534 174 157 26 582 26 705 0 99-22 202-63 253-101 53-40 87-116 87-191 0-152-120-262-335-306-82-17-143-19-676-19h-587l-5-102c-8-149-9-488-1-595l6-93h557c306 0 610-5 676-10 312-25 463-133 442-316-11-99-105-187-252-234-156-49-298-63-610-57-366 7-526 38-750 147-183 89-263 146-410 295l-131 133-30-21c-16-12-96-71-179-132-82-62-233-172-335-245-102-73-224-162-272-197l-88-65 29-37c60-76 290-288 386-358 334-239 722-386 1180-447 309-41 1029-47 1335-11 580 68 1024 244 1318 521 144 135 250 311 286 473 23 100 23 265 1 361-44 189-176 368-379 512-74 53-301 167-373 189-24 7-43 15-43 18 1 3 35 22 78 41 418 190 627 497 583 859-67 549-685 921-1646 990-212 16-601 21-775 10Z" />
      </g>
      {variant === 'upcoming' ? <>
        <g className="brand-logo-pixel-fill" clipPath={`url(#${clipId}-pixel-fill)`} aria-hidden="true">
          {Array.from({ length: 26 * 36 }, (_, index) => {
            const column = index % 26
            const row = Math.floor(index / 26)
            const x = column * SYMBOL_GRID.cellWidth
            const y = row * SYMBOL_GRID.cellHeight
            const centerX = x < 282 ? 125.5 : 439.5
            const distance = Math.min(1, Math.hypot((x + 11 - centerX) / 500, (y + 11 - 388) / 388))
            const intensity = (1 - distance) ** 1.3
            const seed = (column * 7 + row * 11) % 10
            const variation = seed >= 8 ? 1.25 : 0.8 + seed * 0.02
            return <rect key={index} className="brand-logo-pixel" x={620 + x} y={74 + y} width={SYMBOL_GRID.cellWidth - 2} height={SYMBOL_GRID.cellHeight - 2} fill="#FF5964" fillOpacity={0.04 + intensity * variation * 0.76} style={{ animationDelay: `${2400 + Math.round(distance * 420)}ms` }} />
          })}
        </g>
        <g className="brand-logo-incoming-lines" fill="none" stroke="#FF5964" strokeWidth="18" aria-hidden="true">
          <path className="brand-logo-incoming-line" d="M451 888.36L789 482" pathLength="1" />
          <path className="brand-logo-incoming-line" d="M1040 48.64L702 455" pathLength="1" />
          <g transform="translate(314 0)">
            <path className="brand-logo-incoming-line" d="M451 888.36L789 482" pathLength="1" />
            <path className="brand-logo-incoming-line" d="M1040 48.64L702 455" pathLength="1" />
          </g>
        </g>
        <g className="brand-logo-upcoming-solids" fill="currentColor">
          <path d="M323 355h73v125l104-125h77v225h-76V457L397 580h-74Z" />
          <path d="M1227 355h73v125l94-125h76v225h-73V457l-97 123h-73Z" />
        </g>
        <g fill="#FF5964">
          <g className="brand-logo-guide-pair brand-logo-guide-pair-first">
            <path mask={`url(#${clipId}-guide-lower)`} d="M602 183.82 620 162.18V671.11L798 457.11V850.58L780 872.22V506.89L602 720.89Z" />
            <path mask={`url(#${clipId}-guide-upper)`} d="M693 74.42 711 52.78V430.11L889 216.11V741.18L871 762.82V265.89L693 479.89Z" />
          </g>
          <g transform="translate(314 0)">
            <g className="brand-logo-guide-pair brand-logo-guide-pair-second">
              <path mask={`url(#${clipId}-guide-lower)`} d="M602 183.82 620 162.18V671.11L798 457.11V850.58L780 872.22V506.89L602 720.89Z" />
              <path mask={`url(#${clipId}-guide-upper)`} d="M693 74.42 711 52.78V430.11L889 216.11V741.18L871 762.82V265.89L693 479.89Z" />
            </g>
          </g>
        </g>
      </> : <g className="brand-logo-mark" fill="currentColor">
        <g className="brand-logo-letter brand-logo-letter-1">
          <path className="brand-logo-part" clipPath={`url(#${clipId}-i-1)`} d="M625 544h140l330-386H955Z" />
          <rect className="brand-logo-permanent-stem" x="640" y="158" width="110" height="386" />
          <rect className="brand-logo-added-stem" x="970" y="158" width="110" height="386" />
        </g>
        <g className="brand-logo-letter brand-logo-letter-2">
          <path className="brand-logo-part" clipPath={`url(#${clipId}-i-2)`} d="M850 544h140l330-386h-140Z" />
          <rect className="brand-logo-added-stem" x="865" y="158" width="110" height="386" />
          <rect className="brand-logo-added-stem" x="1195" y="158" width="110" height="386" />
        </g>
        <g className="brand-logo-letter brand-logo-letter-3">
          <path className="brand-logo-part" clipPath={`url(#${clipId}-i-3)`} d="M1075 544h140l330-386h-140Z" />
          <rect className="brand-logo-added-stem" x="1090" y="158" width="110" height="386" />
          <rect className="brand-logo-permanent-stem" x="1420" y="158" width="110" height="386" />
        </g>
      </g>}
    </svg>
  )
}
