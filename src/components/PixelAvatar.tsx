import { memo, type ReactElement } from 'react';

// Pixelový hrdina 12×12. Výzbroj se mění s titulem (Nováček → Legenda).
const BASE = [
  '....HHHH....',
  '...HHHHHH...',
  '...HSSSSH...',
  '...SESSES...',
  '....SSSS....',
  '..AAATTAAA..',
  '.SAAATTAAAS.',
  '.S.AAAAAA.S.',
  '...AAAAAA...',
  '...LL..LL...',
  '...LL..LL...',
  '..BBB..BBB..',
];

interface Tier { hair: string; armor: string; trim: string; legs: string; boots: string; helmet?: boolean; sword?: boolean; cape?: string; crown?: boolean }

const TIERS: Tier[] = [
  { hair: '#6b4423', armor: '#8b7355', trim: '#a0896b', legs: '#4a3b2a', boots: '#3a2a1a' }, // Nováček – plátěná košile
  { hair: '#6b4423', armor: '#3f7d4a', trim: '#5fa36b', legs: '#4a3b2a', boots: '#3a2a1a' }, // Učeň – zelená tunika
  { hair: '#6b4423', armor: '#3b6fb6', trim: '#6fa0e0', legs: '#2c3e5c', boots: '#3a2a1a' }, // Tovaryš – modrá
  { hair: '#9aa3b5', armor: '#8a93a6', trim: '#c9d0dc', legs: '#5a6272', boots: '#3a3f4a', helmet: true, sword: true }, // Bojovník – ocel
  { hair: '#9aa3b5', armor: '#6b4fa3', trim: '#a78bfa', legs: '#3d2f63', boots: '#2a2240', helmet: true, sword: true }, // Veterán
  { hair: '#b0303a', armor: '#a3303a', trim: '#f87171', legs: '#5c1d22', boots: '#3a1216', helmet: true, sword: true, cape: '#7a1f27' }, // Mistr
  { hair: '#d4a017', armor: '#c99a1e', trim: '#ffe28a', legs: '#7a5c10', boots: '#4a380a', helmet: true, sword: true, cape: '#3b6fb6' }, // Velmistr
  { hair: '#f5c542', armor: '#f5c542', trim: '#fff3c4', legs: '#b8860b', boots: '#7a5a08', helmet: true, sword: true, cape: '#a3303a', crown: true }, // Legenda
];

export const PixelAvatar = memo(function PixelAvatar({ tier, size = 56 }: { tier: number; size?: number }) {
  const t = TIERS[Math.max(0, Math.min(TIERS.length - 1, tier))];
  const color: Record<string, string> = {
    H: t.helmet ? t.trim : t.hair, S: '#f1c27d', E: '#1a1a2e', A: t.armor, T: t.trim, L: t.legs, B: t.boots,
  };
  const rects: ReactElement[] = [];
  if (t.cape) {
    for (let y = 5; y <= 10; y++) rects.push(<rect key={`c${y}`} x={2} y={y} width={8} height={1} fill={t.cape} opacity={0.85} />);
  }
  BASE.forEach((row, y) => [...row].forEach((ch, x) => {
    if (color[ch]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={color[ch]} />);
  }));
  if (t.sword) {
    for (let y = 2; y <= 8; y++) rects.push(<rect key={`s${y}`} x={11} y={y} width={1} height={1} fill={y < 7 ? '#e5e7eb' : '#8b5a2b'} />);
    rects.push(<rect key="guard" x={10} y={7} width={2} height={1} fill={t.trim} />);
  }
  if (t.crown) {
    rects.push(<rect key="cr0" x={4} y={-1} width={4} height={1} fill="#ffd700" />);
    [4, 6, 7].forEach((x) => rects.push(<rect key={`cr${x}`} x={x} y={-2} width={1} height={1} fill="#ffd700" />));
  }
  return (
    <svg viewBox="-0.5 -2.5 13 15" width={size} height={size} shapeRendering="crispEdges" aria-hidden>
      {rects}
    </svg>
  );
});
