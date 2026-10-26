// Kreslená pevnost (boční panorama ve stylu Shakes & Fidget): kopec s hradem, budovy na terasách.
// Budovy se mění s levelem – 1–3 dřevo, 4–6 kámen, 7–9 mramor a zlato – a s levelem přibývají věže a prapory.
import type { ReactNode } from 'react';
import type { BuildingId } from './data';
import { tierOf } from './sprites';

const INK = '#2b1d12';

interface Pal { wall: string; wallD: string; roof: string; roofD: string; trim: string; win: string }
const PALS: Pal[] = [
  { wall: '#c99a5e', wallD: '#a77a42', roof: '#b5482f', roofD: '#8c3320', trim: '#6e4321', win: '#3b2a1c' },
  { wall: '#b8bcc6', wallD: '#8e94a1', roof: '#3f6fb5', roofD: '#2c5290', trim: '#545c6b', win: '#2a2f3a' },
  { wall: '#f2eee3', wallD: '#cfc8b5', roof: '#e7b53b', roofD: '#b98a1f', trim: '#9c7a2a', win: '#3a3220' },
];

/** Okno – v noci svítí. */
const Win = ({ x, y, w = 8, h = 11, night, p }: { x: number; y: number; w?: number; h?: number; night: boolean; p: Pal }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={w / 2} fill={night ? '#ffd76a' : p.win} stroke={INK} strokeWidth={1.4} />
    {night && <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} rx={w} fill="#ffd76a" opacity={0.25} />}
    <line x1={x + w / 2} y1={y + 1} x2={x + w / 2} y2={y + h - 1} stroke={INK} strokeWidth={0.8} opacity={0.6} />
  </g>
);

const Flag = ({ x, y, color = '#d62828', h = 22 }: { x: number; y: number; color?: string; h?: number }) => (
  <g>
    <line x1={x} y1={y} x2={x} y2={y - h} stroke={INK} strokeWidth={1.6} />
    <path className="f-flag" d={`M${x} ${y - h} l14 4 l-14 6 z`} fill={color} stroke={INK} strokeWidth={1.2} style={{ transformOrigin: `${x}px ${y - h}px` }} />
  </g>
);

/** Kuželová střecha věže. */
const Cone = ({ x, y, w, h, p }: { x: number; y: number; w: number; h: number; p: Pal }) => (
  <g>
    <path d={`M${x - w / 2 - 3} ${y} L${x} ${y - h} L${x + w / 2 + 3} ${y} Z`} fill={p.roof} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
    <path d={`M${x} ${y - h} L${x + w / 2 + 3} ${y} L${x + 2} ${y} Z`} fill={p.roofD} opacity={0.6} />
  </g>
);

/** Cimbuří nad zdí. */
const Crenel = ({ x, y, w, p, n }: { x: number; y: number; w: number; p: Pal; n: number }) => (
  <g>
    {Array.from({ length: n }, (_, i) => {
      const cw = w / (n * 2 - 1);
      return <rect key={i} x={x + i * cw * 2} y={y - 6} width={cw} height={6} fill={p.wall} stroke={INK} strokeWidth={1.4} />;
    })}
  </g>
);

/** Zeď se stínem a obrysem. */
const Wall = ({ x, y, w, h, p, stone }: { x: number; y: number; w: number; h: number; p: Pal; stone?: boolean }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} fill={p.wall} stroke={INK} strokeWidth={1.8} />
    <rect x={x + w * 0.72} y={y} width={w * 0.28} height={h} fill={p.wallD} opacity={0.55} />
    {stone
      ? Array.from({ length: Math.floor(h / 9) }, (_, i) => <line key={i} x1={x + 2} y1={y + 9 + i * 9} x2={x + w - 2} y2={y + 9 + i * 9} stroke={INK} strokeWidth={0.5} opacity={0.35} />)
      : Array.from({ length: Math.floor(w / 9) }, (_, i) => <line key={i} x1={x + 9 + i * 9} y1={y + 2} x2={x + 9 + i * 9} y2={y + h - 2} stroke={INK} strokeWidth={0.5} opacity={0.35} />)}
  </g>
);

const Door = ({ x, y, w = 14, h = 20 }: { x: number; y: number; w?: number; h?: number }) => (
  <path d={`M${x - w / 2} ${y} v${-h + w / 2} a${w / 2} ${w / 2} 0 0 1 ${w} 0 v${h - w / 2} z`} fill="#5a3418" stroke={INK} strokeWidth={1.6} />
);

type Draw = (lvl: number, night: boolean) => ReactNode;

/** Kresby budov – souřadnice relativně ke středu spodní hrany (y nahoru záporné). */
const DRAW: Record<BuildingId, Draw> = {
  hall: (lvl, night) => {
    const p = PALS[tierOf(lvl)];
    const t = tierOf(lvl);
    return (
      <g>
        {/* boční věže */}
        {[-48, 48].map((dx) => (
          <g key={dx}>
            <Wall x={dx - 13} y={-92} w={26} h={92} p={p} stone={t > 0} />
            <Cone x={dx} y={-92} w={26} h={30} p={p} />
            <Win x={dx - 4} y={-72} night={night} p={p} />
            {t >= 1 && <Win x={dx - 4} y={-44} night={night} p={p} />}
          </g>
        ))}
        {/* hlavní budova */}
        <Wall x={-36} y={-70} w={72} h={70} p={p} stone={t > 0} />
        <Crenel x={-36} y={-70} w={72} p={p} n={6} />
        <Door x={0} y={0} w={18} h={28} />
        <Win x={-26} y={-55} night={night} p={p} />
        <Win x={18} y={-55} night={night} p={p} />
        {/* centrální věž */}
        <Wall x={-14} y={-118} w={28} h={48} p={p} stone={t > 0} />
        <Cone x={0} y={-118} w={28} h={t === 2 ? 40 : 32} p={p} />
        <Win x={-4} y={-104} night={night} p={p} />
        <Flag x={0} y={t === 2 ? -158 : -150} color={t === 2 ? '#7c3aed' : '#d62828'} />
        {lvl >= 3 && <Flag x={-48} y={-122} color="#2563eb" h={16} />}
        {lvl >= 5 && <Flag x={48} y={-122} color="#2563eb" h={16} />}
        {/* prapory na zdi */}
        {lvl >= 2 && [-22, 22].map((dx) => <path key={dx} d={`M${dx - 5} -66 h10 v20 l-5 -4 l-5 4 z`} fill="#b91c1c" stroke={INK} strokeWidth={1} />)}
        {t === 2 && <circle cx={0} cy={-80} r={6} fill="#facc15" stroke={INK} strokeWidth={1.2} />}
      </g>
    );
  },
  barracks: (lvl, night) => {
    const p = PALS[tierOf(lvl)];
    return (
      <g>
        <Wall x={-40} y={-38} w={80} h={38} p={p} stone={tierOf(lvl) > 0} />
        <path d="M-46 -38 L-30 -64 L30 -64 L46 -38 Z" fill={p.roof} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        <path d="M10 -64 L30 -64 L46 -38 L22 -38 Z" fill={p.roofD} opacity={0.5} />
        <Door x={0} y={0} />
        <Win x={-30} y={-28} night={night} p={p} />
        <Win x={22} y={-28} night={night} p={p} />
        {/* štít se zkříženými meči */}
        <line x1={-12} y1={-56} x2={12} y2={-44} stroke="#d1d5db" strokeWidth={2.4} />
        <line x1={12} y1={-56} x2={-12} y2={-44} stroke="#d1d5db" strokeWidth={2.4} />
        <path d="M-7 -56 h14 v8 q-7 7 -14 0 z" fill="#b91c1c" stroke={INK} strokeWidth={1.2} />
        {lvl >= 3 && <><Wall x={34} y={-70} w={18} h={70} p={p} stone /><Cone x={43} y={-70} w={18} h={20} p={p} /></>}
        <Flag x={-40} y={-38} color="#b91c1c" h={30} />
        {/* stojan se zbraněmi */}
        <line x1={-52} y1={0} x2={-52} y2={-20} stroke={INK} strokeWidth={1.5} />
        <path d="M-52 -20 l-3 -6 l6 0 z" fill="#d1d5db" stroke={INK} strokeWidth={0.8} />
      </g>
    );
  },
  forge: (lvl, night) => {
    const p = PALS[tierOf(lvl)];
    return (
      <g>
        {/* komín s kouřem */}
        <rect x={16} y={-66} width={12} height={34} fill="#7c6f64" stroke={INK} strokeWidth={1.6} />
        {[0, 1, 2].map((i) => <circle key={i} className="f-smoke" cx={22} cy={-72} r={6 + i} fill="#9ca3af" opacity={0.7} style={{ animationDelay: `${i * 0.9}s` }} />)}
        <Wall x={-32} y={-34} w={64} h={34} p={p} stone={tierOf(lvl) > 0} />
        <path d="M-38 -34 L0 -58 L38 -34 Z" fill={p.roof} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        {/* výheň */}
        <rect x={-24} y={-26} width={22} height={18} rx={3} fill="#3b2a1c" stroke={INK} strokeWidth={1.4} />
        <rect className="f-glow" x={-21} y={-20} width={16} height={10} rx={2} fill="#fb923c" />
        <Door x={16} y={0} w={12} h={18} />
        {/* kovadlina */}
        <path d="M-48 0 v-6 h-6 v-4 h18 q0 4 -4 4 h-2 v6 z" fill="#4b5563" stroke={INK} strokeWidth={1.2} />
        {lvl >= 4 && <Win x={-4} y={-50} w={8} h={8} night={night} p={p} />}
      </g>
    );
  },
  academy: (lvl, night) => {
    const p = PALS[tierOf(lvl)];
    const dome = tierOf(lvl) === 2 ? '#e7b53b' : tierOf(lvl) === 1 ? '#6d28d9' : '#7c3aed';
    return (
      <g>
        <Wall x={-24} y={-70} w={48} h={70} p={p} stone={tierOf(lvl) > 0} />
        <path d="M-28 -70 Q0 -112 28 -70 Z" fill={dome} stroke={INK} strokeWidth={1.8} />
        <path d="M2 -98 Q20 -90 28 -70 L6 -70 Z" fill="#000" opacity={0.15} />
        <circle className="f-glow" cx={0} cy={-108} r={4} fill="#facc15" stroke={INK} strokeWidth={1} />
        <Win x={-14} y={-56} night={night} p={p} />
        <Win x={6} y={-56} night={night} p={p} />
        <Door x={0} y={0} w={14} h={22} />
        {/* knihy u vchodu */}
        <rect x={-38} y={-10} width={10} height={10} fill="#2563eb" stroke={INK} strokeWidth={1} />
        <rect x={-36} y={-18} width={10} height={8} fill="#dc2626" stroke={INK} strokeWidth={1} />
        {lvl >= 4 && <circle cx={0} cy={-36} r={6} fill="none" stroke="#facc15" strokeWidth={1.5} />}
      </g>
    );
  },
  tower: (lvl, night) => {
    const p = PALS[tierOf(lvl)];
    const h = 96 + Math.min(lvl, 9) * 3;
    return (
      <g>
        <path d={`M-16 0 L-13 ${-h} L13 ${-h} L16 0 Z`} fill={p.wall} stroke={INK} strokeWidth={1.8} />
        <path d={`M6 0 L7 ${-h} L13 ${-h} L16 0 Z`} fill={p.wallD} opacity={0.55} />
        <rect x={-19} y={-h - 10} width={38} height={12} fill={p.wall} stroke={INK} strokeWidth={1.6} />
        <Crenel x={-19} y={-h - 10} w={38} p={p} n={4} />
        <rect x={-2} y={-h + 18} width={4} height={14} fill={INK} />
        <Win x={-4} y={-h + 46} night={night} p={p} />
        <Door x={0} y={0} w={12} h={18} />
        <Flag x={0} y={-h - 16} color="#2563eb" h={26} />
        {/* lučištník na věži */}
        <circle cx={-10} cy={-h - 20} r={4} fill="#3f7d4a" stroke={INK} strokeWidth={1} />
      </g>
    );
  },
  storage: (lvl, night) => {
    const p = PALS[tierOf(lvl)];
    return (
      <g>
        <Wall x={-36} y={-40} w={72} h={40} p={p} stone={tierOf(lvl) > 0} />
        <path d="M-42 -40 L0 -70 L42 -40 Z" fill={p.roof} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        <path d="M0 -70 L42 -40 L14 -40 Z" fill={p.roofD} opacity={0.5} />
        <rect x={-14} y={-30} width={28} height={30} fill="#7a4a26" stroke={INK} strokeWidth={1.6} />
        <path d="M-14 -30 L14 0 M14 -30 L-14 0" stroke={INK} strokeWidth={1.2} />
        <Win x={-4} y={-58} w={8} h={8} night={night} p={p} />
        {/* bedny a sudy */}
        <rect x={-58} y={-14} width={14} height={14} fill="#a0703c" stroke={INK} strokeWidth={1.2} />
        <rect x={-54} y={-26} width={12} height={12} fill="#b5824a" stroke={INK} strokeWidth={1.2} />
        <ellipse cx={50} cy={-9} rx={8} ry={9} fill="#8b5a2b" stroke={INK} strokeWidth={1.2} />
        {lvl >= 4 && <circle cx={50} cy={-28} r={7} fill="#facc15" stroke={INK} strokeWidth={1.2} />}
      </g>
    );
  },
  sawmill: (lvl, night) => {
    const p = PALS[tierOf(lvl)];
    return (
      <g>
        <Wall x={-28} y={-32} w={56} h={32} p={p} />
        <path d="M-34 -32 L-8 -54 L34 -32 Z" fill={p.roof} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        <Door x={-12} y={0} w={12} h={18} />
        <Win x={8} y={-24} night={night} p={p} />
        {/* pila */}
        <g className="f-spin" style={{ transformOrigin: '34px -38px' }}>
          <circle cx={34} cy={-38} r={10} fill="#d1d5db" stroke={INK} strokeWidth={1.4} />
          <path d="M34 -48 l2 4 M44 -38 l-4 2 M34 -28 l-2 -4 M24 -38 l4 -2" stroke={INK} strokeWidth={1.4} />
        </g>
        {/* hromada klád */}
        {[0, 1, 2].map((i) => <ellipse key={i} cx={38 + i * 9} cy={-6} rx={5} ry={6} fill="#c08850" stroke={INK} strokeWidth={1.2} />)}
        <ellipse cx={42} cy={-16} rx={5} ry={6} fill="#c08850" stroke={INK} strokeWidth={1.2} />
        <ellipse cx={51} cy={-16} rx={5} ry={6} fill="#c08850" stroke={INK} strokeWidth={1.2} />
        {lvl >= 4 && <ellipse cx={46} cy={-26} rx={5} ry={6} fill="#c08850" stroke={INK} strokeWidth={1.2} />}
      </g>
    );
  },
  quarry: (lvl) => (
    <g>
      {/* skalní stěna s vylámanými bloky */}
      <path d="M-46 0 L-40 -40 L-18 -58 L10 -50 L30 -62 L46 -30 L48 0 Z" fill="#8f939c" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M-30 -30 h20 v14 h-20 z M0 -40 h22 v16 h-22 z" fill="#b8bcc4" stroke={INK} strokeWidth={1.2} />
      <path d="M10 -50 L30 -62 L46 -30 L24 -24 Z" fill="#000" opacity={0.12} />
      {/* vozík s kameny */}
      <rect x={-12} y={-14} width={26} height={10} fill="#7a4a26" stroke={INK} strokeWidth={1.2} />
      <circle cx={-6} cy={-3} r={3} fill={INK} />
      <circle cx={8} cy={-3} r={3} fill={INK} />
      <circle cx={-4} cy={-17} r={4} fill="#9ca3af" stroke={INK} strokeWidth={1} />
      <circle cx={5} cy={-18} r={4} fill="#9ca3af" stroke={INK} strokeWidth={1} />
      {/* krumpáč */}
      <line x1={-40} y1={-6} x2={-28} y2={-26} stroke="#7a4a26" strokeWidth={2.4} />
      <path d="M-34 -28 q6 -2 10 4" stroke="#4b5563" strokeWidth={2.4} fill="none" />
      {lvl >= 4 && <path d="M30 0 v-20 h12 v20" fill="none" stroke={INK} strokeWidth={1.4} />}
    </g>
  ),
  mine: (lvl) => (
    <g>
      <path d="M-46 0 Q-44 -56 0 -60 Q44 -56 46 0 Z" fill="#7d8089" stroke={INK} strokeWidth={1.8} />
      <path d="M-22 0 V-26 Q0 -46 22 -26 V0 Z" fill="#1b1b24" stroke={INK} strokeWidth={1.8} />
      {/* dřevěná výztuž */}
      <path d="M-22 0 V-28 H22 V0" fill="none" stroke="#7a4a26" strokeWidth={3} />
      {/* krystaly */}
      {[[-10, -6], [6, -10], [-2, -16], [14, -4]].slice(0, 2 + Math.min(2, Math.floor(lvl / 3))).map(([x, y], i) => (
        <path key={i} className="f-crystal" d={`M${x} ${y} l4 -10 l4 10 l-4 5 z`} fill="#67e8f9" stroke="#0e7490" strokeWidth={1} style={{ animationDelay: `${i * 0.4}s` }} />
      ))}
      <path className="f-crystal" d="M-40 -2 l3 -9 l3 9 z M34 -4 l3 -9 l3 9 z" fill="#a5f3fc" stroke="#0e7490" strokeWidth={0.8} />
      {/* koleje */}
      <path d="M-6 0 L-14 10 M6 0 L14 10" stroke={INK} strokeWidth={1.2} />
    </g>
  ),
  walls: (lvl) => {
    const p = PALS[tierOf(lvl)];
    return (
      <g>
        {[-1, 1].map((s) => (
          <g key={s}>
            <Wall x={s < 0 ? -112 : 22} y={-30} w={90} h={30} p={p} stone />
            <Crenel x={s < 0 ? -112 : 22} y={-30} w={90} p={p} n={8} />
          </g>
        ))}
        {/* brána s věžičkami */}
        {[-30, 18].map((x) => (
          <g key={x}>
            <Wall x={x} y={-48} w={12} h={48} p={p} stone />
            <Crenel x={x} y={-48} w={12} p={p} n={2} />
          </g>
        ))}
        <path d="M-18 0 V-30 Q0 -44 18 -30 V0 Z" fill="#5a3418" stroke={INK} strokeWidth={1.8} />
        {Array.from({ length: 4 }, (_, i) => <line key={i} x1={-14 + i * 9} y1={-34} x2={-14 + i * 9} y2={0} stroke={INK} strokeWidth={1} />)}
        {lvl >= 4 && <Flag x={-24} y={-48} color="#b91c1c" h={18} />}
        {lvl >= 4 && <Flag x={24} y={-48} color="#b91c1c" h={18} />}
      </g>
    );
  },
};

/** Kde budovy stojí ve scéně 400 × 520 (střed spodní hrany) a jak jsou velké. */
export const SCENE = { w: 400, h: 520 };
export const PLACES: Record<BuildingId, { x: number; y: number; s: number }> = {
  hall: { x: 200, y: 178, s: 1 },
  academy: { x: 108, y: 252, s: 0.9 },
  tower: { x: 300, y: 252, s: 0.9 },
  barracks: { x: 80, y: 340, s: 0.95 },
  storage: { x: 208, y: 322, s: 0.9 },
  forge: { x: 328, y: 340, s: 0.95 },
  walls: { x: 200, y: 410, s: 1 },
  sawmill: { x: 62, y: 470, s: 0.95 },
  mine: { x: 218, y: 488, s: 0.95 },
  quarry: { x: 342, y: 472, s: 0.95 },
};

const NAMES: Record<BuildingId, string> = {
  hall: 'Radnice', barracks: 'Kasárna', forge: 'Kovárna', academy: 'Akademie', tower: 'Věž', storage: 'Sklad',
  walls: 'Hradby', sawmill: 'Pila', quarry: 'Kamenolom', mine: 'Důl',
};

function Sign({ x, y, text, level, glow }: { x: number; y: number; text: string; level: number; glow: boolean }) {
  const w = text.length * 5.6 + 22;
  return (
    <g transform={`translate(${x} ${y})`} className={glow ? 'f-sign glow' : 'f-sign'}>
      <rect x={-w / 2} y={0} width={w} height={14} rx={3} fill="#e8cf98" stroke={INK} strokeWidth={1.3} />
      <circle cx={-w / 2 + 8} cy={7} r={5.5} fill="#f5c542" stroke={INK} strokeWidth={1} />
      <text x={-w / 2 + 8} y={10} textAnchor="middle" fontSize={8} fontWeight={700} fill={INK}>{level}</text>
      <text x={-w / 2 + 16} y={10.6} fontSize={9.5} fontWeight={700} fill={INK} fontFamily="Georgia, serif">{text}{glow ? ' ⬆' : ''}</text>
    </g>
  );
}

/** Lešení přes stavěnou budovu. */
const Scaffold = () => (
  <g opacity={0.9}>
    {[-40, -14, 12, 38].map((x) => <line key={x} x1={x} y1={0} x2={x} y2={-80} stroke="#8b5a2b" strokeWidth={2.4} />)}
    {[-20, -45, -70].map((y) => <line key={y} x1={-44} y1={y} x2={42} y2={y} stroke="#8b5a2b" strokeWidth={2.4} />)}
    <path d="M-40 -20 L-14 -45 M12 -20 L38 -45 M-40 -70 L-14 -45" stroke="#8b5a2b" strokeWidth={1.6} />
  </g>
);

export function FortressScene({ levels, night, building, canUp, onOpen }: {
  levels: Record<BuildingId, number>; night: boolean; building: BuildingId | null; canUp: (id: BuildingId) => boolean; onOpen: (id: BuildingId) => void;
}) {
  const order: BuildingId[] = ['hall', 'academy', 'tower', 'storage', 'barracks', 'forge', 'walls', 'mine', 'sawmill', 'quarry'];
  return (
    <svg viewBox={`0 0 ${SCENE.w} ${SCENE.h}`} className="fortress-svg" role="group" aria-label="Pevnost">
      <defs>
        <linearGradient id="f-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? '#0b1638' : '#6fb6ef'} />
          <stop offset="1" stopColor={night ? '#2a3466' : '#d7eefc'} />
        </linearGradient>
        <linearGradient id="f-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? '#3c5a3a' : '#6aa84f'} />
          <stop offset="1" stopColor={night ? '#24361f' : '#3f7a35'} />
        </linearGradient>
        <linearGradient id="f-rock" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={night ? '#5d6170' : '#a3a7b0'} />
          <stop offset="1" stopColor={night ? '#3e414c' : '#7a7e88'} />
        </linearGradient>
      </defs>
      {/* nebe */}
      <rect width={SCENE.w} height={SCENE.h} fill="url(#f-sky)" />
      {night ? (
        <g>
          {Array.from({ length: 28 }, (_, i) => <circle key={i} cx={(i * 137) % 400} cy={(i * 53) % 170} r={i % 3 ? 0.9 : 1.5} fill="#fff" className="f-twinkle" style={{ animationDelay: `${(i % 7) * 0.4}s` }} />)}
          <circle cx={330} cy={60} r={20} fill="#f8f3d4" />
          <circle cx={322} cy={54} r={18} fill="#0b1638" opacity={0.85} />
        </g>
      ) : (
        <g>
          <circle cx={335} cy={62} r={34} fill="#fff4b0" opacity={0.5} />
          <circle cx={335} cy={62} r={24} fill="#ffe066" stroke="#f4b400" strokeWidth={2} />
        </g>
      )}
      {[[40, 70, 1], [230, 40, 0.8], [140, 110, 0.7]].map(([x, y, s], i) => (
        <g key={i} className="f-cloud" style={{ animationDuration: `${60 + i * 25}s`, animationDelay: `${-i * 20}s` }} opacity={night ? 0.25 : 0.95}>
          <g transform={`translate(${x} ${y}) scale(${s})`}>
            <ellipse cx={0} cy={0} rx={30} ry={13} fill="#fff" />
            <ellipse cx={22} cy={-8} rx={20} ry={14} fill="#fff" />
            <ellipse cx={-20} cy={-5} rx={16} ry={11} fill="#fff" />
          </g>
        </g>
      ))}
      {/* hory v pozadí */}
      <path d="M0 250 L50 170 L95 215 L150 140 L205 205 L260 150 L320 210 L370 160 L400 190 V520 H0 Z" fill={night ? '#29325c' : '#8a9ccc'} />
      <path d="M150 140 L163 160 L150 156 L138 162 Z M260 150 L272 168 L258 164 L248 168 Z" fill="#fff" opacity={night ? 0.4 : 0.85} />
      <path d="M0 300 Q60 250 120 285 Q190 240 260 280 Q330 245 400 285 V520 H0 Z" fill={night ? '#2f4a2c' : '#5d9a48'} />
      {/* les vlevo a vpravo */}
      {[12, 30, 380, 362].map((x, i) => (
        <g key={x} transform={`translate(${x} ${300 + (i % 2) * 8})`}>
          <rect x={-2} y={-2} width={4} height={12} fill="#5a3418" />
          <path d="M0 -34 L14 0 H-14 Z" fill={night ? '#1f4d2a' : '#2f7d3f'} stroke={INK} strokeWidth={1.2} />
        </g>
      ))}
      {/* hlavní kopec s terasami */}
      <path d="M-10 520 L-10 400 Q20 360 30 345 L130 345 Q138 300 120 262 L180 262 Q170 225 170 182 L230 182 Q230 225 220 262 L290 262 Q270 300 280 345 L370 345 Q385 362 410 400 L410 520 Z"
        fill="url(#f-rock)" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      {/* tráva na terasách */}
      <path d="M28 345 H132 M118 262 H182 M168 182 H232 M218 262 H292 M278 345 H372" stroke={night ? '#3c5a3a' : '#6aa84f'} strokeWidth={6} strokeLinecap="round" />
      {/* kamenná textura skály */}
      {[[60, 380], [150, 300], [250, 300], [330, 385], [110, 420], [290, 430], [200, 240], [190, 360]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} q8 -6 16 0`} stroke={INK} strokeWidth={1} fill="none" opacity={0.35} />
      ))}
      {/* cesta nahoru */}
      <path d="M200 520 Q180 470 210 430 Q240 395 200 360 Q170 330 205 300 Q235 270 200 240 Q185 215 200 190"
        stroke={night ? '#6b5a3c' : '#c7a86a'} strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.85} />
      {/* louka vpředu */}
      <path d="M-10 520 V470 Q60 445 130 465 Q200 448 270 466 Q340 448 410 470 V520 Z" fill="url(#f-hill)" stroke={INK} strokeWidth={1.5} />
      {/* budovy (odzadu dopředu) */}
      {order.map((id) => {
        const pl = PLACES[id];
        const lvl = levels[id] ?? 1;
        return (
          <g key={id} className="f-building" transform={`translate(${pl.x} ${pl.y}) scale(${pl.s})`} role="button" tabIndex={0}
            aria-label={`${NAMES[id]} level ${lvl}`} onClick={() => onOpen(id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(id)}>
            <ellipse cx={0} cy={2} rx={id === 'walls' ? 120 : 50} ry={5} fill="#000" opacity={0.18} />
            {DRAW[id](lvl, night)}
            {building === id && <Scaffold />}
            <Sign x={0} y={6} text={NAMES[id]} level={lvl} glow={building !== id && canUp(id)} />
          </g>
        );
      })}
      {/* keře v popředí */}
      {[[20, 508], [120, 512], [290, 510], [385, 506]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={11} fill={night ? '#1f4d2a' : '#3c8a3a'} stroke={INK} strokeWidth={1.2} />
          <circle cx={x + 10} cy={y + 3} r={8} fill={night ? '#1f4d2a' : '#4a9a45'} stroke={INK} strokeWidth={1.2} />
        </g>
      ))}
    </svg>
  );
}

/** Obrázek jedné budovy (náhled v okně budovy). */
export function BuildingPicture({ id, level, size }: { id: BuildingId; level: number; size: number }) {
  const box = id === 'walls' ? '-120 -60 240 72' : '-62 -168 124 176';
  const [, , w, h] = box.split(' ').map(Number);
  return (
    <svg viewBox={box} width={size} height={(size * h) / w} aria-hidden>
      {DRAW[id](level, false)}
    </svg>
  );
}
