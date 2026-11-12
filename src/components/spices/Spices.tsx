/**
 * Original SVG spice illustrations used as floating ingredients.
 * Each takes a unique `uid` so gradient ids never collide when the same spice is drawn twice.
 * Replace with real cut-out photography later if available – the hero only expects ReactNodes.
 */
type P = { uid: string; className?: string; style?: React.CSSProperties };

export function StarAnise({ uid, className, style }: P) {
  const g = `sa-${uid}`;
  return (
    <svg viewBox="-110 -110 220 220" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${g}-pod`} x1="0" y1="-1" x2="0" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#5a2a12" />
          <stop offset="0.55" stopColor="#9c4f22" />
          <stop offset="1" stopColor="#6b3216" />
        </linearGradient>
        <radialGradient id={`${g}-seed`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#f0b36a" />
          <stop offset="0.45" stopColor="#b8692c" />
          <stop offset="1" stopColor="#5e2c10" />
        </radialGradient>
      </defs>
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i} transform={`rotate(${i * 45 + (i % 2 ? 4 : -3)})`}>
          <path d="M0,-6 C17,-30 19,-72 0,-100 C-19,-72 -17,-30 0,-6 Z" fill={`url(#${g}-pod)`} stroke="#3e1b0a" strokeWidth="1.5" />
          <path d="M0,-22 C8,-38 9,-62 0,-80 C-9,-62 -8,-38 0,-22 Z" fill="#2c1206" opacity="0.85" />
          <ellipse cx="0" cy="-52" rx="6.5" ry="15" fill={`url(#${g}-seed)`} />
          <ellipse cx="-2" cy="-58" rx="1.8" ry="5" fill="#ffe3b8" opacity="0.55" />
          <path d="M-10,-30 C-13,-55 -9,-80 0,-98" stroke="#c97a3d" strokeWidth="1.2" fill="none" opacity="0.55" />
        </g>
      ))}
      <circle r="11" fill="#4a210c" />
      <circle r="5" fill="#7b3d18" />
    </svg>
  );
}

export function Cardamom({ uid, className, style, open = false }: P & { open?: boolean }) {
  const g = `cd-${uid}`;
  return (
    <svg viewBox="-50 -78 100 156" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${g}-b`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5f7f2c" />
          <stop offset="0.45" stopColor="#b3cd73" />
          <stop offset="0.7" stopColor="#93b452" />
          <stop offset="1" stopColor="#4f6c22" />
        </linearGradient>
      </defs>
      <path d="M0,-66 C26,-55 34,10 4,62 C2,66 -2,66 -4,62 C-34,10 -26,-55 0,-66 Z" fill={`url(#${g}-b)`} stroke="#4a6420" strokeWidth="1.2" />
      {[-14, -6, 4, 13].map((x, i) => (
        <path key={i} d={`M${x * 0.3},-60 C${x * 1.5},-30 ${x * 1.55},20 ${x * 0.2},60`} stroke="#5c7a2a" strokeWidth="1.3" fill="none" opacity="0.7" />
      ))}
      <path d="M-6,-50 C-14,-20 -14,10 -8,34" stroke="#e7f3c4" strokeWidth="3" fill="none" opacity="0.35" strokeLinecap="round" />
      <path d="M0,-66 L0,-74" stroke="#6b5a2a" strokeWidth="3" strokeLinecap="round" />
      {open && (
        <g>
          <path d="M-2,-30 C14,-20 16,22 0,40 C-16,22 -16,-20 -2,-30Z" fill="#2c1a10" />
          {[-14, -2, 10, 22].map((y, i) => (
            <circle key={i} cx={i % 2 ? 4 : -4} cy={y} r="6" fill="#3b2416" stroke="#1b0e07" />
          ))}
        </g>
      )}
    </svg>
  );
}

export function Clove({ uid, className, style }: P) {
  const g = `cl-${uid}`;
  return (
    <svg viewBox="-30 -70 60 140" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${g}-s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2e160a" />
          <stop offset="0.5" stopColor="#7a4327" />
          <stop offset="1" stopColor="#331a0c" />
        </linearGradient>
        <radialGradient id={`${g}-h`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#a8683e" />
          <stop offset="1" stopColor="#3a1d0d" />
        </radialGradient>
      </defs>
      <path d="M-7,-22 L-4,62 C-3.5,67 3.5,67 4,62 L7,-22 Z" fill={`url(#${g}-s)`} />
      {[-1, 1].map((s) => (
        <path key={s} d={`M0,-22 C${s * 10},-24 ${s * 16},-34 ${s * 15},-44 C${s * 8},-40 ${s * 4},-32 0,-28 Z`} fill="#5b2e16" stroke="#2a1307" strokeWidth="0.8" />
      ))}
      <path d="M0,-22 C6,-30 6,-40 0,-46 C-6,-40 -6,-30 0,-22Z" fill="#4b2511" />
      <circle cx="0" cy="-48" r="10" fill={`url(#${g}-h)`} />
      <circle cx="-3" cy="-51" r="2.5" fill="#d29b6c" opacity="0.5" />
    </svg>
  );
}

export function Cinnamon({ uid, className, style }: P) {
  const g = `cn-${uid}`;
  return (
    <svg viewBox="-150 -40 300 80" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${g}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e09a5a" />
          <stop offset="0.35" stopColor="#b8642c" />
          <stop offset="0.8" stopColor="#8a431b" />
          <stop offset="1" stopColor="#5e2b10" />
        </linearGradient>
      </defs>
      <path d="M-130,-28 L128,-30 C142,-30 142,30 128,30 L-130,28 Z" fill={`url(#${g}-b)`} />
      {[-90, -40, 10, 60, 100].map((x, i) => (
        <path key={i} d={`M${x},-27 C${x + 6},-8 ${x - 4},8 ${x + 3},28`} stroke="#6d3314" strokeWidth="1.2" fill="none" opacity="0.5" />
      ))}
      <path d="M-120,-17 L120,-19" stroke="#f3c08a" strokeWidth="2.5" opacity="0.35" strokeLinecap="round" />
      <ellipse cx="-130" cy="0" rx="13" ry="28" fill="#9c5124" />
      <path d="M-130,-21 C-119,-18 -118,15 -130,21 C-141,15 -140,-6 -131,-9 C-125,-9 -124,6 -130,9" stroke="#4a200b" strokeWidth="2" fill="none" />
    </svg>
  );
}

export function BayLeaf({ uid, className, style }: P) {
  const g = `bl-${uid}`;
  return (
    <svg viewBox="-60 -125 120 250" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${g}-l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a9ae5c" />
          <stop offset="0.5" stopColor="#7f8a3a" />
          <stop offset="1" stopColor="#59621f" />
        </linearGradient>
      </defs>
      <clipPath id={`${g}-c`}><path d="M0,-115 C48,-70 46,48 2,112 C-44,50 -46,-70 0,-115 Z" /></clipPath>
      <path d="M0,-115 C48,-70 46,48 2,112 C-44,50 -46,-70 0,-115 Z" fill={`url(#${g}-l)`} stroke="#4f5719" strokeWidth="1.2" />
      <g clipPath={`url(#${g}-c)`}>
      <path d="M0,-112 C3,-40 4,40 2,118" stroke="#d6d79a" strokeWidth="2" fill="none" opacity="0.8" />
      {[-80, -55, -30, -5, 20, 45, 70].map((y, i) => (
        <g key={i} stroke="#cfd08c" strokeWidth="1" fill="none" opacity="0.55">
          <path d={`M2,${y} C14,${y - 8} 24,${y - 18} 30,${y - 30}`} />
          <path d={`M2,${y + 6} C-10,${y - 2} -20,${y - 12} -28,${y - 24}`} />
        </g>
      ))}
      <path d="M-20,-60 C-30,-20 -28,30 -12,70" stroke="#e9ebb6" strokeWidth="5" opacity="0.18" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Peppercorn({ uid, className, style }: P) {
  const g = `pc-${uid}`;
  return (
    <svg viewBox="-20 -20 40 40" className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={`${g}-p`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#7a5a42" />
          <stop offset="0.5" stopColor="#3a271b" />
          <stop offset="1" stopColor="#140c07" />
        </radialGradient>
      </defs>
      <circle r="16" fill={`url(#${g}-p)`} />
      <path d="M-10,-4 C-6,-8 -2,-2 3,-6 M-8,6 C-3,2 2,8 8,3 M-2,-12 C1,-8 5,-11 8,-8" stroke="#140c07" strokeWidth="1.3" fill="none" opacity="0.7" />
      <ellipse cx="-6" cy="-7" rx="3.5" ry="2.2" fill="#c9a88a" opacity="0.4" />
    </svg>
  );
}

export function Nutmeg({ uid, className, style }: P) {
  const g = `nm-${uid}`;
  return (
    <svg viewBox="-50 -40 100 80" className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={`${g}-n`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#c08a5a" />
          <stop offset="0.55" stopColor="#8a5530" />
          <stop offset="1" stopColor="#4a2a14" />
        </radialGradient>
      </defs>
      <ellipse rx="44" ry="33" fill={`url(#${g}-n)`} />
      <path
        d="M-30,-10 C-20,-20 -8,-6 4,-16 C14,-24 24,-12 34,-18 M-36,8 C-24,0 -12,14 0,4 C12,-6 22,10 36,2 M-24,22 C-12,14 0,26 12,18 C20,12 28,20 32,16"
        stroke="#4a2a14"
        strokeWidth="1.6"
        fill="none"
        opacity="0.55"
      />
      <ellipse cx="-14" cy="-14" rx="12" ry="6" fill="#f0c9a0" opacity="0.18" />
    </svg>
  );
}
