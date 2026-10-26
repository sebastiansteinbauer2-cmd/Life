import { store, useQuery } from '../../app/context';
import { dateKey } from '../../lib/date';
import { RES_ICON, buildingDef } from './data';
import { useFort, useNow } from './useFort';

/** Karta pevnosti na domovské obrazovce. */
export default function FortCard() {
  const ctx = useFort();
  const now = useNow(30_000);
  const activeToday = useQuery(async () => (await store.col('xpLog').all()).some((e) => e.date === dateKey() && e.amount > 0));
  if (!ctx) return null;
  const f = ctx.fort;
  return (
    <a href="#/fort" className="panel row" style={{ textDecoration: 'none', color: 'var(--text)', marginTop: 12 }}>
      <span style={{ fontSize: '1.6rem' }}>🏰</span>
      <div className="grow">
        <b>Pevnost hrdiny</b>
        {f ? (
          <div className="small muted">
            {RES_ICON.wood} {Math.floor(ctx.bal.wood)} · {RES_ICON.stone} {Math.floor(ctx.bal.stone)} · {RES_ICON.crystal} {Math.floor(ctx.bal.crystal)}
            {' · '}
            {f.upgrade ? (now >= f.upgrade.endsAt ? <span style={{ color: 'var(--green)' }}>{buildingDef(f.upgrade.id).name} hotová!</span> : `🔨 ${buildingDef(f.upgrade.id).name}`) : 'stavitel volný'}
            {ctx.pend.wood + ctx.pend.stone + ctx.pend.crystal > 0 && (
              <div style={{ color: 'var(--green)' }}>🫧 K sebrání: {(['wood', 'stone', 'crystal'] as const).filter((k) => ctx.pend[k] > 0).map((k) => `${RES_ICON[k]} +${ctx.pend[k]}`).join(' ')}</div>
            )}
            {ctx.activeToday && f.chestDay !== dateKey() && <div style={{ color: 'var(--gold)' }}>🎁 Denní truhla čeká na otevření!</div>}
            {activeToday === false && <div style={{ color: 'var(--red)' }}>⚠️ Dnes ještě nemáš XP – v noci hrozí nájezd!</div>}
          </div>
        ) : (
          <div className="small muted">Postav pevnost a bojuj – suroviny získáváš za skutečné questy.</div>
        )}
      </div>
      <span className="small muted">›</span>
    </a>
  );
}
