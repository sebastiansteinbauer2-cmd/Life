import { useEffect, useRef, useState } from 'react';
import { store, useProfile, useQuery } from '../../app/context';
import { navigate } from '../../app/router';
import { PixelAvatar } from '../../components/PixelAvatar';
import { Empty, MiniBar, Modal, Tabs } from '../../components/ui';
import type { FortState } from '../../data/types';
import { STAT_LABEL, titleTier } from '../../game/xp';
import { dateKey, formatDate } from '../../lib/date';
import { H, W, attackUnit, autoTurn, createBattle, endTurn, moveUnit, reachable, targetsFrom, unitAt, type Battle } from './battle';
import {
  BUILDINGS, CAMPS, ENEMIES, RES_ICON, RES_LABEL, UNITS, armyCap, buildMinutes, buildingDef, campScale, type BuildingId, type Camp,
  type Res,
} from './data';
import {
  applyBattle, armySize, battleArmy, canTrain, canUpgrade, defense, maxLevel, modifiers, speedUp, speedUpCost, startUpgrade, train,
  unlockedCamp, type Raid,
} from './economy';
import { checkFort, createFort, useFort, useNow, type FortCtx } from './useFort';

const TABS = [
  { path: '/fort', label: '🏰 Pevnost' },
  { path: '/fort/army', label: '⚔️ Armáda' },
  { path: '/fort/campaign', label: '🗺️ Výpravy' },
  { path: '/fort/log', label: '📜 Kronika' },
];

const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${m} min` : m ? `${m} min ${s % 60} s` : `${s} s`;
};
const fmtMinutes = (min: number) => (min >= 60 ? `${Math.round(min / 60)} h` : `${min} min`);

export function ResBar({ bal }: { bal: Res }) {
  return (
    <div className="res-bar">
      {(Object.keys(RES_ICON) as (keyof Res)[]).map((k) => (
        <span key={k} title={RES_LABEL[k]}>{RES_ICON[k]} <b>{Math.floor(bal[k]).toLocaleString('cs-CZ')}</b></span>
      ))}
    </div>
  );
}

function Cost({ cost, bal }: { cost: Res; bal: Res }) {
  return (
    <span className="small">
      {(Object.keys(cost) as (keyof Res)[]).filter((k) => cost[k] > 0).map((k) => (
        <span key={k} style={{ marginRight: 8, color: bal[k] >= cost[k] ? undefined : 'var(--red)' }}>{RES_ICON[k]} {cost[k]}</span>
      ))}
    </span>
  );
}

function Header({ ctx, active }: { ctx: FortCtx; active: string }) {
  return (
    <>
      <h1>🏰 Pevnost hrdiny</h1>
      <ResBar bal={ctx.bal} />
      <Tabs items={TABS} active={active} />
    </>
  );
}

function Intro() {
  return (
    <div>
      <h1>🏰 Pevnost hrdiny</h1>
      <section className="panel gold stack">
        <p style={{ margin: 0 }}>Postav si pevnost, vycvič armádu a vydej se na výpravy proti goblinům, orkům a nakonec drakovi.</p>
        <p className="small" style={{ margin: 0 }}>
          Suroviny získáváš <b>za skutečné úkoly</b> – každé XP je jedna surovina:<br />
          🪵 <b>dřevo</b> za Sílu a Vytrvalost · 🪨 <b>kámen</b> za Inteligenci a Šachy · 💎 <b>krystaly</b> za Disciplínu.
        </p>
        <p className="small" style={{ margin: 0 }}>⚠️ Pozor: když vynecháš den bez jediného XP, přijde na pevnost nájezd. Hradby a věže ho můžou odrazit – jinak ti nájezdníci ukradnou část surovin.</p>
        <button className="primary btn-block" onClick={() => createFort()}>🏗️ Založit pevnost</button>
      </section>
    </div>
  );
}

function RaidReport({ raids, onClose }: { raids: Raid[]; onClose: () => void }) {
  return (
    <Modal open={raids.length > 0} onClose={onClose} title="⚔️ Zatímco jsi byl pryč…">
      <div className="stack">
        {raids.map((r) => (
          <div key={r.date} className="panel" style={{ margin: 0 }}>
            <b>{formatDate(r.date)}: {r.win ? '🛡️ Nájezd odražen!' : '🔥 Pevnost vyrabována'}</b>
            <div className="small muted">Síla nájezdníků {r.strength} · tvoje obrana {r.defense}</div>
            {!r.win && <div className="small" style={{ color: 'var(--red)' }}>Ukradeno: 🪵 {r.stolen.wood} · 🪨 {r.stolen.stone}</div>}
          </div>
        ))}
        <p className="small muted" style={{ margin: 0 }}>Nájezd přijde za každý den bez XP. Pomůžou vyšší Hradby, Obranná věž, větší armáda a Sklad (chrání část surovin).</p>
        <button className="primary btn-block" onClick={onClose}>Rozumím</button>
      </div>
    </Modal>
  );
}

function BuildingModal({ ctx, fort, id, onClose }: { ctx: FortCtx; fort: FortState; id: BuildingId | null; onClose: () => void }) {
  const now = useNow();
  if (!id) return null;
  const def = buildingDef(id);
  const lvl = fort.buildings[id];
  const check = canUpgrade(fort, id, ctx.bal);
  const building = fort.upgrade?.id === id;
  const maxed = lvl >= def.maxLevel;
  return (
    <Modal open onClose={onClose} title={`${def.icon} ${def.name} – level ${lvl}`}>
      <div className="stack">
        <p className="small" style={{ margin: 0 }}>{def.text}</p>
        <div className="small">Teď: <b>{def.effect(lvl)}</b>{!maxed && <> → level {lvl + 1}: <b>{def.effect(lvl + 1)}</b></>}</div>
        {building ? (
          <>
            <div>🔨 Staví se… zbývá <b>{fmtTime(fort.upgrade!.endsAt - now)}</b></div>
            <button className="btn-gold btn-block" disabled={ctx.bal.crystal < speedUpCost(fort, now)}
              onClick={async () => { await ctx.save(speedUp(fort, ctx.bal, Date.now())); onClose(); }}>
              ⚡ Dokončit hned za 💎 {speedUpCost(fort, now)}
            </button>
          </>
        ) : maxed ? (
          <p style={{ color: 'var(--gold)', margin: 0 }}>Maximální level 👑</p>
        ) : (
          <>
            <div>Cena: <Cost cost={def.cost(lvl + 1)} bal={ctx.bal} /> · ⏱️ {fmtMinutes(buildMinutes(lvl + 1))}</div>
            <button className="primary btn-block" disabled={!check.ok}
              onClick={async () => { await ctx.save(startUpgrade(fort, id, ctx.bal, Date.now())); onClose(); }}>
              ⬆️ Vylepšit na level {lvl + 1}
            </button>
            {!check.ok && <p className="small muted" style={{ margin: 0 }}>{check.reason}</p>}
          </>
        )}
        {id !== 'hall' && !maxed && <p className="small muted" style={{ margin: 0 }}>Max. level teď: {maxLevel(fort, id)} (podle Radnice)</p>}
      </div>
    </Modal>
  );
}

function FortHome({ ctx, fort }: { ctx: FortCtx; fort: FortState }) {
  const now = useNow();
  const [open, setOpen] = useState<BuildingId | null>(null);
  const [raids, setRaids] = useState<Raid[]>([]);
  useEffect(() => {
    checkFort().then((r) => r.length && setRaids(r));
  }, []);
  useEffect(() => {
    // stavba doběhla, zatímco je obrazovka otevřená
    if (fort.upgrade && now >= fort.upgrade.endsAt) checkFort();
  }, [now, fort.upgrade]);
  const p = useProfile();
  const m = modifiers(fort);
  return (
    <div>
      <Header ctx={ctx} active="/fort" />
      <div className="fort-base">
        <div className="fort-hero"><PixelAvatar tier={titleTier(ctx.heroLevel)} size={40} /></div>
        {BUILDINGS.map((b) => {
          const up = fort.upgrade?.id === b.id ? fort.upgrade : null;
          const can = canUpgrade(fort, b.id, ctx.bal).ok;
          return (
            <button key={b.id} className={`fort-bld ${up ? 'building' : ''}`} onClick={() => setOpen(b.id)}>
              <span className="ic">{b.icon}</span>
              <span className="lv">{fort.buildings[b.id]}</span>
              {can && !up && <span className="up" aria-label="Lze vylepšit">⬆</span>}
              <span className="nm">{b.name}</span>
              {up && <span className="tm">🔨 {fmtTime(up.endsAt - now)}</span>}
            </button>
          );
        })}
      </div>
      <section className="panel">
        <div className="small">
          🔨 Stavitel: {fort.upgrade ? <b>staví {buildingDef(fort.upgrade.id).name} (zbývá {fmtTime(fort.upgrade.endsAt - now)})</b> : <b style={{ color: 'var(--green)' }}>volný – klepni na budovu</b>}
        </div>
        <div className="small" style={{ marginTop: 6 }}>
          ⚔️ Armáda {armySize(fort)}/{armyCap(fort.buildings.barracks)} · 🗡️ útok +{Math.round((m.atk - 1) * 100)} % · ❤️ životy +{Math.round((m.hp - 1) * 100)} % · 🛡️ obrana {defense(fort)}
        </div>
      </section>
      <section className="panel small">
        <b>Odkud jsou suroviny?</b> Za XP ze skutečného života: 🪵 Síla + Vytrvalost, 🪨 Inteligence + Šachy, 💎 Disciplína.
        Splň každý den aspoň jeden quest, jinak přijde nájezd. Hrdina {p.name} má level {ctx.heroLevel} – s každým levelem je v bitvě silnější.
      </section>
      <BuildingModal ctx={ctx} fort={fort} id={open} onClose={() => setOpen(null)} />
      <RaidReport raids={raids} onClose={() => setRaids([])} />
    </div>
  );
}

function FortArmy({ ctx, fort }: { ctx: FortCtx; fort: FortState }) {
  const m = modifiers(fort);
  const hero = battleArmy(fort, ctx.heroLevel)[0].stats;
  return (
    <div>
      <Header ctx={ctx} active="/fort/army" />
      <p className="small">Armáda {armySize(fort)} / {armyCap(fort.buildings.barracks)} vojáků. Padlí v bitvě se musí vycvičit znovu, hrdina se vždy vrátí.</p>
      <MiniBar value={armySize(fort) / armyCap(fort.buildings.barracks)} color="var(--m-fort)" />
      <section className="panel row" style={{ marginTop: 12 }}>
        <PixelAvatar tier={titleTier(ctx.heroLevel)} size={44} />
        <div className="grow">
          <b>Hrdina (level {ctx.heroLevel})</b>
          <div className="small muted">❤️ {hero.hp} · 🗡️ {hero.atk} · 👣 {hero.move} · 🎯 {hero.range}</div>
          <div className="small muted">Sílí s tvým levelem ve skutečném životě.</div>
        </div>
      </section>
      {UNITS.map((u) => {
        const check = canTrain(fort, u.id, ctx.bal, ctx.statLevels);
        return (
          <section key={u.id} className="panel">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '1.6rem' }}>{u.icon}</span> <b>{u.name}</b> <span className="pixel" style={{ color: 'var(--m-fort)' }}>×{fort.army[u.id]}</span>
                <div className="small muted">❤️ {Math.round(u.hp * m.hp)} · 🗡️ {Math.round(u.atk * m.atk)} · 👣 {u.move} · 🎯 {u.range}</div>
              </div>
              <button className="primary" disabled={!check.ok} onClick={() => ctx.save(train(fort, u.id, ctx.bal, ctx.statLevels))}>+ Vycvičit</button>
            </div>
            <div className="small" style={{ marginTop: 6 }}>{u.text}</div>
            <div style={{ marginTop: 4 }}><Cost cost={u.cost} bal={ctx.bal} /></div>
            {u.stat && <div className="small muted">Odemyká: Kasárna {u.barracks} + {STAT_LABEL[u.stat.id]} level {u.stat.level} (máš {ctx.statLevels[u.stat.id]})</div>}
            {!check.ok && <div className="small" style={{ color: 'var(--muted)' }}>🔒 {check.reason}</div>}
          </section>
        );
      })}
    </div>
  );
}

function CampModal({ fort, camp, onClose }: { fort: FortState; camp: Camp | null; onClose: () => void }) {
  if (!camp) return null;
  const k = campScale(camp.id);
  const done = (fort.camps[camp.id] ?? 0) > 0;
  const counts = camp.enemies.reduce<Record<string, number>>((a, e) => ({ ...a, [e]: (a[e] ?? 0) + 1 }), {});
  return (
    <Modal open onClose={onClose} title={`${camp.icon} ${camp.id}. ${camp.name}`}>
      <div className="stack">
        <div className="small"><b>Nepřátelé:</b></div>
        {Object.entries(counts).map(([id, n]) => {
          const e = ENEMIES[id as keyof typeof ENEMIES];
          return <div key={id} className="small">{e.icon} {e.name} ×{n} <span className="muted">❤️ {Math.round(e.hp * k.hp)} · 🗡️ {Math.round(e.atk * k.atk)} · 🎯 {e.range}</span></div>;
        })}
        <div className="small"><b>Kořist:</b> 🪵 {camp.loot.wood} · 🪨 {camp.loot.stone} · 💎 {camp.loot.crystal}{done ? ' (opakovaně 40 %)' : ' + 💎 10 za první dobytí'}</div>
        <div className="small muted">Do boje jde hrdina a celá armáda ({armySize(fort)} vojáků). Kdo padne, je ztracený.</div>
        <button className="primary btn-block" onClick={() => { onClose(); navigate(`/fort/battle/${camp.id}`); }}>⚔️ Do boje!</button>
      </div>
    </Modal>
  );
}

function FortCampaign({ ctx, fort }: { ctx: FortCtx; fort: FortState }) {
  const [open, setOpen] = useState<Camp | null>(null);
  const next = unlockedCamp(fort);
  return (
    <div>
      <Header ctx={ctx} active="/fort/campaign" />
      <div className="camp-list">
        {CAMPS.map((c) => {
          const st = fort.camps[c.id] ?? 0;
          const locked = c.id > next;
          return (
            <button key={c.id} className={`camp ${locked ? 'locked' : ''} ${c.id === next ? 'next' : ''}`} disabled={locked} onClick={() => setOpen(c)}>
              <span className="ic">{locked ? '🔒' : c.icon}</span>
              <span className="grow" style={{ textAlign: 'left' }}>
                <b>{c.id}. {c.name}</b>
                <span className="small muted" style={{ display: 'block' }}>{c.enemies.map((e) => ENEMIES[e].icon).join('')}</span>
              </span>
              <span className="stars">{[1, 2, 3].map((i) => (i <= st ? '⭐' : '☆')).join('')}</span>
            </button>
          );
        })}
      </div>
      <CampModal fort={fort} camp={open} onClose={() => setOpen(null)} />
    </div>
  );
}

const BATTLE_KEY = 'questy.fort.battle';
function loadBattle(campId: number): Battle | null {
  try {
    const x = JSON.parse(localStorage.getItem(BATTLE_KEY) ?? 'null') as { campId: number; battle: Battle } | null;
    return x && x.campId === campId && !x.battle.over ? x.battle : null;
  } catch {
    return null;
  }
}
function storeBattle(campId: number, battle: Battle | null) {
  try {
    if (battle && !battle.over) localStorage.setItem(BATTLE_KEY, JSON.stringify({ campId, battle }));
    else localStorage.removeItem(BATTLE_KEY);
  } catch { /* nevadí */ }
}

function FortBattle({ ctx, fort, campId }: { ctx: FortCtx; fort: FortState; campId: number }) {
  const camp = CAMPS.find((c) => c.id === campId);
  const [b, setB] = useState<Battle | null>(() => (camp ? loadBattle(campId) ?? createBattle(battleArmy(fort, ctx.heroLevel), camp) : null));
  const [sel, setSel] = useState<string | null>(null);
  const [result, setResult] = useState<{ stars: number; loot: Res; first: boolean; fallen: string[] } | null>(null);
  const finished = useRef(false);
  const tier = titleTier(ctx.heroLevel);

  useEffect(() => {
    if (camp && b) storeBattle(campId, b);
    if (!camp || !b?.over || finished.current) return;
    finished.current = true;
    const r = applyBattle(fort, camp, b);
    const lost = b.units.filter((u) => u.side === 'me' && u.hp <= 0 && u.kind !== 'hero').map((u) => u.icon);
    setResult({ stars: r.stars, loot: r.loot, first: r.first, fallen: lost });
    (async () => {
      await ctx.save(r.state);
      await store.col('fortLog').put({
        id: `battle:${Date.now()}`, ts: Date.now(), date: dateKey(), kind: 'battle', win: r.stars > 0, stars: r.stars,
        title: `${camp.icon} ${camp.name}`, res: r.loot,
      });
    })();
  }, [b, camp, campId, fort, ctx]);

  if (!camp || !b) return <Empty>Výprava nenalezena. <a href="#/fort/campaign">Zpět</a></Empty>;
  if (camp.id > unlockedCamp(fort) && !result) return <Empty>Tahle výprava je ještě zamčená. <a href="#/fort/campaign">Zpět</a></Empty>;

  const selected = b.units.find((u) => u.id === sel && u.hp > 0) ?? null;
  const moves = selected && selected.side === 'me' ? reachable(b, selected) : [];
  const targets = selected && selected.side === 'me' && !selected.acted ? targetsFrom(b, selected) : [];
  const rocks = new Set(b.rocks);
  const myLeft = b.units.filter((u) => u.side === 'me' && u.hp > 0 && !u.acted).length;

  const tap = (x: number, y: number) => {
    if (b.over) return;
    const u = unitAt(b, x, y);
    if (selected && u && u.side === 'foe' && targets.some((t) => t.id === u.id)) {
      setB(attackUnit(b, selected.id, u.id));
      setSel(null);
      return;
    }
    if (selected && !u && moves.some((p) => p.x === x && p.y === y) && (selected.x !== x || selected.y !== y)) {
      setB(moveUnit(b, selected.id, x, y));
      return;
    }
    setSel(u ? u.id : null);
  };

  const info = selected ?? null;
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>{camp.icon} {camp.name}</h1>
        <span className="pixel small">Tah {b.turn}</span>
      </div>
      <div className="battle-grid" style={{ gridTemplateColumns: `repeat(${W}, 1fr)` }}>
        {Array.from({ length: W * H }, (_, i) => {
          const x = i % W;
          const y = Math.floor(i / W);
          const u = unitAt(b, x, y);
          const isMove = !u && moves.some((p) => p.x === x && p.y === y) && !!selected && !selected.moved;
          const isTarget = !!u && targets.some((t) => t.id === u.id);
          const cls = ['cell', rocks.has(`${x},${y}`) ? 'rock' : '', isMove ? 'move' : '', isTarget ? 'target' : '', u?.id === sel ? 'sel' : '',
            u ? u.side : '', u && u.side === 'me' && u.acted ? 'done' : ''].join(' ');
          return (
            <button key={i} className={cls} onClick={() => tap(x, y)} aria-label={u ? `${u.name} ${u.hp}/${u.maxHp}` : `pole ${x + 1},${y + 1}`}>
              {rocks.has(`${x},${y}`) && <span className="ic">{(x + y) % 2 ? '🌲' : '🪨'}</span>}
              {u && (
                <>
                  <span className="ic">{u.kind === 'hero' ? <PixelAvatar tier={tier} size={28} /> : u.icon}</span>
                  <span className="hp"><span style={{ width: `${(u.hp / u.maxHp) * 100}%` }} /></span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="small battle-info">
        {info ? (
          <>
            <b>{info.icon} {info.name}</b> ❤️ {info.hp}/{info.maxHp} · 🗡️ {info.atk} · 👣 {info.move} · 🎯 {info.range}
            {info.side === 'me' && <span className="muted"> · {info.acted ? 'už táhl' : info.moved ? 'může zaútočit' : 'klepni kam jít, nebo na nepřítele'}</span>}
          </>
        ) : (
          <span className="muted">Klepni na svou jednotku: modrá pole = kam může jít, červený rámeček = na koho dosáhne. Zbývá táhnout: {myLeft}.</span>
        )}
      </div>
      <div className="grid3" style={{ marginTop: 8 }}>
        <button onClick={() => { setB(autoTurn(b)); setSel(null); }} disabled={!!b.over}>⚡ Auto</button>
        <button className="primary" onClick={() => { setB(endTurn(b)); setSel(null); }} disabled={!!b.over}>Konec tahu ›</button>
        <button className="btn-danger" disabled={!!b.over} onClick={() => confirm('Vzdát bitvu? Padlé jednotky budou ztracené.') && setB({ ...b, over: 'lose' })}>Vzdát</button>
      </div>
      <div className="battle-log small">
        {b.log.slice(-5).map((l, i) => <div key={b.log.length - 5 + i}>{l}</div>)}
      </div>
      <Modal open={!!result} onClose={() => navigate('/fort/campaign')} title={result && result.stars ? '🏆 Vítězství!' : '💀 Porážka'}>
        {result && (
          <div className="stack">
            {result.stars > 0 && <div className="pixel" style={{ fontSize: '2rem', textAlign: 'center' }}>{[1, 2, 3].map((i) => (i <= result.stars ? '⭐' : '☆')).join('')}</div>}
            {result.stars > 0 && <ResBar bal={result.loot} />}
            {result.first && <p className="small" style={{ margin: 0, color: 'var(--gold)' }}>První dobytí – bonus 💎 10 a odemčena další výprava!</p>}
            {result.fallen.length > 0 ? <p className="small" style={{ margin: 0 }}>Padli: {result.fallen.join(' ')} – vycvič nové v Armádě.</p> : <p className="small" style={{ margin: 0 }}>Nikdo nepadl. 💪</p>}
            {!result.stars && <p className="small muted" style={{ margin: 0 }}>Tip: vylepši Kovárnu a Akademii, vycvič silnější jednotky a drž lučištníky za válečníky.</p>}
            <button className="primary btn-block" onClick={() => navigate('/fort/campaign')}>Zpět na výpravy</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function FortLogPage({ ctx }: { ctx: FortCtx }) {
  const log = useQuery(async () => (await store.col('fortLog').all()).sort((a, b) => b.ts - a.ts).slice(0, 60));
  return (
    <div>
      <Header ctx={ctx} active="/fort/log" />
      {!log?.length && <Empty>Zatím žádné bitvy ani nájezdy.</Empty>}
      {log?.map((l) => (
        <section key={l.id} className="panel row" style={{ justifyContent: 'space-between', padding: '10px 14px' }}>
          <div>
            <b>{l.kind === 'raid' ? (l.win ? '🛡️' : '🔥') : l.win ? '🏆' : '💀'} {l.title}</b>
            <div className="small muted">{formatDate(l.date)}{l.stars ? ` · ${'⭐'.repeat(l.stars)}` : ''}</div>
          </div>
          <span className="small">
            {(Object.keys(RES_ICON) as (keyof Res)[]).filter((k) => l.res[k]).map((k) => (
              <span key={k} style={{ marginLeft: 6, color: l.res[k] > 0 ? 'var(--green)' : 'var(--red)' }}>{l.res[k] > 0 ? '+' : ''}{l.res[k]}{RES_ICON[k]}</span>
            ))}
          </span>
        </section>
      ))}
    </div>
  );
}

export default function FortPages({ route }: { route: string }) {
  const ctx = useFort();
  if (!ctx) return null;
  if (!ctx.fort) return <Intro />;
  const fort = ctx.fort;
  if (route.startsWith('/fort/battle/')) return <FortBattle ctx={ctx} fort={fort} campId={Number(route.split('/').pop())} />;
  if (route === '/fort/army') return <FortArmy ctx={ctx} fort={fort} />;
  if (route === '/fort/campaign') return <FortCampaign ctx={ctx} fort={fort} />;
  if (route === '/fort/log') return <FortLogPage ctx={ctx} />;
  return <FortHome ctx={ctx} fort={fort} />;
}
