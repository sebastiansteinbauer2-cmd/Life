import { store, useQuery } from '../app/context';
import { ACHIEVEMENTS } from '../game/achievements';
import { STAT_LABEL } from '../game/xp';
import { formatDate } from '../lib/date';
import { Hud } from './Home';

export default function Achievements() {
  const unlocked = useQuery(async () => new Map((await store.col('achievements').all()).map((a) => [a.id, a.unlockedAt])));
  const log = useQuery(async () => (await store.col('xpLog').all()).sort((a, b) => b.ts - a.ts).slice(0, 40));
  return (
    <div>
      <Hud />
      <h1>Odznaky <span className="small muted">{unlocked?.size ?? 0}/{ACHIEVEMENTS.length}</span></h1>
      <div className="badge-grid">
        {ACHIEVEMENTS.map((a) => {
          const at = unlocked?.get(a.id);
          return (
            <div key={a.id} className={`badge ${at ? '' : 'locked'}`} title={a.description}>
              <div className="ic">{a.icon}</div>
              <div className="nm">{a.title}</div>
              <div className="ds">{a.description}</div>
              {at && <div className="ds" style={{ color: 'var(--gold)' }}>{new Date(at).toLocaleDateString('cs-CZ')}</div>}
            </div>
          );
        })}
      </div>
      <h2>Historie XP</h2>
      <div className="panel">
        {log?.length ? log.map((e) => (
          <div key={e.id} className="row list-item small">
            <span className="muted" style={{ width: 78 }}>{formatDate(e.date)}</span>
            <span className="grow">{e.label}<br /><span className="muted">{STAT_LABEL[e.stat]}</span></span>
            <span className="xp-chip" style={{ color: e.amount < 0 ? 'var(--red)' : undefined }}>{e.amount > 0 ? '+' : ''}{e.amount}</span>
          </div>
        )) : <div className="empty">Zatím žádné XP.</div>}
      </div>
    </div>
  );
}
