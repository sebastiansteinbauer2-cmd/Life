// Pixelová grafika Pevnosti. Každý sprite je mřížka znaků, barvy určuje paleta.
// Budovy mění vzhled s levelem: 1–3 dřevo, 4–6 kámen a modrá střecha, 7–9 bílý kámen a zlato.
import { memo, type ReactElement } from 'react';
import type { BuildingId } from './data';

const BASE_PAL: Record<string, string> = {
  K: '#14141c', D: '#4a2e1a', G: '#ffd76a', F: '#e63946', P: '#e5e7eb', S: '#9ca3af', s: '#6b7280',
  L: '#8b5a2b', l: '#5c3a1a', M: '#cbd5e1', m: '#64748b', O: '#fb923c', Y: '#facc15', C: '#67e8f9', c: '#3b82f6',
  A: '#a855f7', N: '#a0703c', E: '#f1c27d', B: '#2563eb', g: '#3f7d4a', Q: '#84cc16', q: '#3f6212', R: '#dc2626',
  r: '#7f1d1d', V: '#e5e7eb', X: '#64748b', k: '#1f2937', W: '#a0703c', w: '#7a5230', T: '#e5d3b3',
};

const TIER_PAL = [
  { W: '#a0703c', w: '#7a5230', R: '#b4462f', r: '#86321f' }, // dřevo
  { W: '#9ca3af', w: '#6b7280', R: '#3b6fb6', r: '#2a5390' }, // kámen
  { W: '#eef0f4', w: '#b9bec8', R: '#f5c542', r: '#c99a1e' }, // zlato
];
export const tierOf = (level: number) => (level >= 7 ? 2 : level >= 4 ? 1 : 0);

export const BUILDING_SPRITES: Record<BuildingId, string[]> = {
  hall: [
    '.......PF.......',
    '.......PFF......',
    '.......P........',
    '......KRRK......',
    '.....KRRRRK.....',
    '....KRRrrRRK....',
    '...KKWWWWWWKK...',
    '..KRRRRRRRRRRK..',
    '.KRRrrrrrrrrRRK.',
    'KRRRRRRRRRRRRRRK',
    '.KWWWWWWWWWWWWK.',
    '.KWGWWWDDWWWGWK.',
    '.KWGWWWDDWWWGWK.',
    '.KwwwwwDDwwwwwK.',
    '.KKKKKKKKKKKKKK.',
  ],
  barracks: [
    '..........F.....',
    '..........FF....',
    '.....KKKKKP.....',
    '....KRRRRRPK....',
    '...KRRRRRRRRK...',
    '..KRRrrrrrrRRK..',
    '.KRRRRRRRRRRRRK.',
    'KKKKKKKKKKKKKKKK',
    '.KWWWWWWWWWWWWK.',
    '.KWMWWWWWWWWMWK.',
    '.KWWMWWDDWWMWWK.',
    '.KWWWMWDDWMWWWK.',
    '.KwwwwwDDwwwwwK.',
    '.KKKKKKKKKKKKKK.',
  ],
  forge: [
    '...........ss...',
    '..........ss....',
    '..........KK....',
    '.....KKKKKKSK...',
    '....KRRRRRRSK...',
    '...KRRrrrrRSRK..',
    '..KRRRRRRRRRRRK.',
    '..KKKKKKKKKKKKK.',
    '..KWWWWWWWWWWK..',
    '..KWOOWWWWWWWK..',
    '..KWOYOWWDDWWK..',
    '..KwOOwwwDDwwK..',
    '..KKKKKKKKKKKK..',
    '.....mMMm.......',
    '......mm........',
  ],
  academy: [
    '.......KK.......',
    '......KAAK......',
    '.....KAAAAK.....',
    '....KAAAAAAK....',
    '...KKKKKKKKKK...',
    '...KRRRRRRRRK...',
    '..KKKKKKKKKKKK..',
    '..KWSWWSWWSWWK..',
    '..KWSWWSWWSWWK..',
    '..KWSWWSWWSWWK..',
    '..KWWWWDDWWWWK..',
    '..KwwwwDDwwwwK..',
    '.KKKKKKKKKKKKKK.',
  ],
  walls: [
    'KKK.KKK.KKK.KKK.',
    'KWK.KWK.KWK.KWK.',
    'KWKKKWKKKWKKKWKK',
    'KWWWWWWWWWWWWWWK',
    'KWwWWwWWwWWwWWwK',
    'KWWWWWWWWWWWWWWK',
    'KwWWwWWwWWwWWwWK',
    'KKKKKKKKKKKKKKKK',
  ],
  tower: [
    '.....F..........',
    '.....FF.........',
    '.....P..........',
    '....KRK.........',
    '...KRRRK........',
    '..KRRrRRK.......',
    '.KKKKKKKKK......',
    '..KWWWWWK.......',
    '..KWGGGWK.......',
    '..KWWWWWK.......',
    '..KwWWWwK.......',
    '..KWWGWWK.......',
    '..KWWWWWK.......',
    '.KKwDDDwKK......',
    '.KKKKKKKKK......',
  ],
  storage: [
    '.......KK.......',
    '.....KKRRKK.....',
    '...KKRRRRRRKK...',
    '..KRRRRrrRRRRK..',
    '.KRRRRRRRRRRRRK.',
    '.KKKKKKKKKKKKKK.',
    '.KWWWWWWWWWWWWK.',
    '.KWNNNNWWNNNNWK.',
    '.KWNKKNWWNKKNWK.',
    '.KWNNNNWWNNNNWK.',
    '.KWWWWDDDDWWWWK.',
    '.KwwwwDDDDwwwwK.',
    '.KKKKKKKKKKKKKK.',
  ],
  sawmill: [
    '....KKKKKK......',
    '...KRRRRRRK.....',
    '..KRRrrrrRRK....',
    '.KRRRRRRRRRRK...',
    '.KKKKKKKKKKKK...',
    '.KWWWWWWWWWWK...',
    '.KWMMWWWWDDWK...',
    '.KWMMWWWWDDWK.KK',
    '.KwwwwwwwDDwKLLK',
    '.KKKKKKKKKKKKlLK',
    '...........KLLLK',
    '...........KlLlK',
    '...........KKKKK',
  ],
  quarry: [
    '..........m.....',
    '.........mM.....',
    '........mMK.....',
    '.......KLK......',
    '......KLK.......',
    '.....KLK........',
    '....KSSKSSK.....',
    '...KSSsSSsSK....',
    '..KSSSSsSSSSK...',
    '.KSsSSSSSsSSSK..',
    'KSSSSsSSSSSsSSK.',
    'KKKKKKKKKKKKKKK.',
  ],
  mine: [
    '.....KKKKKK.....',
    '...KKSSSSSSKK...',
    '..KSSSsSSSsSSK..',
    '.KSSSKKKKKSSSSK.',
    '.KSSKDDDDDKSSSK.',
    'KSSKDDCDDDDKSSK.',
    'KSSKDCcCDCDKSSK.',
    'KSsKDDCDDcCKSsK.',
    'KSSKDDDDDDDKSSK.',
    'KKKKKKKKKKKKKKK.',
    '..C..c....C.....',
  ],
};

export const UNIT_SPRITES: Record<string, string[]> = {
  warrior: ['...MMM....', '..MMMMM...', '..MEEEM...', '..EKEKE...', '...EEE...M', '.OBBBBB.M.', 'OOBBBBBM..', 'OOBBBBB...', '.O.BBB....', '...L.L....', '..LL.LL...'],
  archer: ['...ggg....', '..ggggg...', '..gEEEg..L', '..EKEKE.LP', '...EEE.L.P', '..ggggL..P', '.gggggL..P', '..gggg.L.P', '...gg...LP', '...L.L...L', '..LL.LL...'],
  mage: ['....A.....', '...AAA..Y.', '..AAAAA.N.', '.AAAAAAAN.', '..EKEKE.N.', '...EEE..N.', '..AAAAA.N.', '.AAAAAAAN.', '.AAAAAAAN.', '..AAAAA...', '..LL.LL...'],
  knight: ['P.........', '.P.MMM....', '..PMEEM...', '...PMMM...', '..NNMMMN..', '.NNNNNNNNN', 'NNNNNNNNN.', 'N.NNNNN...', '..N...N...', '..N...N...', '.LL..LL...'],
  goblin: ['..........', '.Q..QQ..Q.', '.QQQQQQQQ.', '..QRQQRQ..', '..QQQQQQ..', '...QKKQ...', '..NNNNNN..', '.QNNNNNNQ.', '..NNNNNN..', '...L..L...', '..LL..LL..'],
  gobArcher: ['..........', '.Q..QQ..QL', '.QQQQQQQLP', '..QRQQRL.P', '..QQQQQL.P', '...QKKQL.P', '..NNNNNNLP', '.QNNNNNN.L', '..NNNNNN..', '...L..L...', '..LL..LL..'],
  orc: ['..qqqqq...', '.qqqqqqq..', '.qRqqqRq.M', '.qqqqqqqMM', '.qVqqqVq.L', '..qqqqq..L', '.mmmmmmm.L', 'qmmmmmmmqL', 'qmmmmmmmq.', '.mmmmmmm..', '..LL.LL...', '.LLL.LLL..'],
  shaman: ['...Q..Q...', '...QQQQ.C.', '..QRQQRQC.', '..QQQQQQN.', '...QQQQ.N.', '..AAAAAAN.', '.AAAAAAAN.', '.AAAAAAA..', '..AAAAA...', '..LL.LL...'],
  skeleton: ['...VVVV...', '..VVVVVV..', '..VKVVKV..', '..VVVVVV..', '...VKKV...', '....VV....', '.VVVVVVVV.', '.V.VVVV.V.', '...V..V...', '...V..V...', '..VV..VV..'],
  troll: ['..XXXXXX..', '.XXXXXXXX.', '.XRXXXXRX.', '.XXXXXXXX.', '.XXVXXVXX.', 'XXXXXXXXXX', 'XXXXXXXXXX', 'X.XXXXXX.X', '..XXXXXX..', '..XX..XX..', '.XXX..XXX.'],
  darkKnight: ['...kkkk...', '..kkkkkk..', '..kRkkRk..', '..kkkkkk.M', '...kkkk.M.', '.AkkkkkkM.', 'AAkkkkkk..', 'AAkkkkkk..', '.A.kkkk...', '...k..k...', '..kk..kk..'],
  dragon: ['r........r', 'rr..RR..rr', 'rrrRRRRrrr', '.rRKRRKRr.', '..RRRRRR..', '..RRYYRR..', '.RRYYYYRR.', 'RRRYYYYRRR', 'R.RRRRRR.R', '..RR..RR..', '.RR....RR.'],
  villager: ['..EE..', '..EE..', '.BBBB.', 'B.BB.B', '..BB..', '..LL..', '.L..L.'],
  chest: ['.KKKKKKKK.', 'KNNNNNNNNK', 'KNYYYYYYNK', 'KKKKYYKKKK', 'KNNNYYNNNK', 'KNNNNNNNNK', 'KKKKKKKKKK'],
  chestOpen: ['KNNNNNNNNK', 'KNYYYYYYNK', 'KKKKKKKKKK', 'KYGYGYGYGK', 'KNNNNNNNNK', 'KNNNNNNNNK', 'KKKKKKKKKK'],
  scaffold: ['N..N..N..N..N..N', 'NNNNNNNNNNNNNNNN', 'N..N..N..N..N..N', '.N..N..N..N..N..', 'NNNNNNNNNNNNNNNN', 'N..N..N..N..N..N'],
};

/** Pixelový obrázek: vodorovné úseky stejné barvy se kreslí jedním obdélníkem. */
export const PixelSprite = memo(function PixelSprite({ rows, pal, size, className, title }: {
  rows: string[]; pal?: Record<string, string>; size: number; className?: string; title?: string;
}) {
  const colors = pal ? { ...BASE_PAL, ...pal } : BASE_PAL;
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const rects: ReactElement[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (colors[ch]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={end - x + 0.02} height={1.02} fill={colors[ch]} />);
      x = end;
    }
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={size} height={(size * h) / w} shapeRendering="crispEdges" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {rects}
    </svg>
  );
});

export function BuildingSprite({ id, level, size }: { id: BuildingId; level: number; size: number }) {
  return <PixelSprite rows={BUILDING_SPRITES[id]} pal={TIER_PAL[tierOf(level)]} size={size} />;
}

export function UnitSprite({ kind, size }: { kind: string; size: number }) {
  const rows = UNIT_SPRITES[kind];
  return rows ? <PixelSprite rows={rows} size={size} /> : null;
}
