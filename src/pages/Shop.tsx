import { useState } from 'react';
import { game, store, useProfile, useQuery } from '../app/context';
import { Empty, Modal } from '../components/ui';
import type { ShopReward } from '../data/types';
import { COIN_RATE, coinBalance, type Purchase } from '../game/weekly';
import { uid } from '../lib/date';

const ICONS = ['🎬', '🎮', '🍕', '😴', '🛍️', '🍫', '☕', '🎧', '🏖️', '🎁'];

/** Obchod: za zlaťáky (1 za každých 10 XP) si „kupuješ“ odměny, které si sám nastavíš. */
export default function Shop() {
  const p = useProfile();
  const purchases = useQuery(async () => ((await store.col('meta').get('shopPurchases'))?.value as Purchase[] | undefined) ?? []);
  const [editing, setEditing] = useState(false);
  if (!purchases) return null;
  const balance = coinBalance(p.xp, purchases);

  const buy = async (r: ShopReward) => {
    if (balance < r.price || !confirm(`Koupit „${r.title}“ za ${r.price} 🪙? Užij si to – zasloužil sis to.`)) return;
    const next: Purchase[] = [...purchases, { id: uid(), rewardId: r.id, title: r.title, icon: r.icon, price: r.price, ts: Date.now() }];
    await store.col('meta').put({ id: 'shopPurchases', value: next });
  };

  return (
    <div>
      <h1>🏪 Obchod</h1>
      <section className="panel gold center">
        <div className="pixel" style={{ fontSize: '2.2rem', color: 'var(--gold)' }}>🪙 {balance}</div>
        <div className="small muted">zlaťáků · 1 🪙 za každých {COIN_RATE} XP</div>
      </section>
      <div className="row between"><h2>Odměny</h2><button className="btn-sm btn-ghost" onClick={() => setEditing(true)}>Upravit</button></div>
      {p.shopRewards.length ? p.shopRewards.map((r) => (
        <div key={r.id} className="quest" style={{ ['--mc' as string]: 'var(--gold)' }}>
          <div className="qicon" aria-hidden>{r.icon}</div>
          <div className="grow"><div className="qtitle">{r.title}</div><div className="qmeta">{balance >= r.price ? 'Můžeš si dovolit' : `Chybí ${r.price - balance} 🪙`}</div></div>
          <button className={balance >= r.price ? 'primary btn-sm' : 'btn-sm'} disabled={balance < r.price} onClick={() => buy(r)}>{r.price} 🪙</button>
        </div>
      )) : <Empty>Žádné odměny. Přidej si je přes Upravit.</Empty>}
      {purchases.length > 0 && (
        <>
          <h2>Historie nákupů</h2>
          <section className="panel">
            {[...purchases].reverse().slice(0, 30).map((x) => (
              <div key={x.id} className="row between list-item small">
                <span>{x.icon} {x.title}</span><span className="muted">{new Date(x.ts).toLocaleDateString('cs-CZ')} · −{x.price} 🪙</span>
              </div>
            ))}
          </section>
        </>
      )}
      <RewardsEditor open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

function RewardsEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = useProfile();
  const [list, setList] = useState<ShopReward[]>(p.shopRewards);
  const update = (i: number, patch: Partial<ShopReward>) => setList(list.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const save = async () => {
    await game.saveProfile({ shopRewards: list.filter((r) => r.title.trim() && r.price > 0).map((r) => ({ ...r, title: r.title.trim() })) });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Odměny">
      {list.map((r, i) => (
        <div key={r.id} className="row" style={{ marginBottom: 8 }}>
          <select value={r.icon} onChange={(e) => update(i, { icon: e.target.value })} style={{ width: 70 }} aria-label="Ikona">
            {[...new Set([r.icon, ...ICONS])].map((ic) => <option key={ic} value={ic}>{ic}</option>)}
          </select>
          <input value={r.title} onChange={(e) => update(i, { title: e.target.value })} aria-label="Název odměny" />
          <input type="number" inputMode="numeric" value={r.price} onChange={(e) => update(i, { price: Number(e.target.value) })} style={{ width: 80 }} aria-label="Cena" />
          <button className="iconbtn btn-ghost" onClick={() => setList(list.filter((_, k) => k !== i))} aria-label="Smazat">🗑</button>
        </div>
      ))}
      <button className="btn-block" onClick={() => setList([...list, { id: uid(), title: '', icon: '🎁', price: 50 }])}>+ Přidat odměnu</button>
      <button className="primary btn-block" style={{ marginTop: 10 }} onClick={save}>Uložit</button>
    </Modal>
  );
}
