import { useCallback, useEffect, useRef, useState } from 'react';
import { store, useQuery } from '../../app/context';
import { navigate } from '../../app/router';
import { PixelAvatar } from '../../components/PixelAvatar';
import { Empty, MiniBar, Modal, Tabs } from '../../components/ui';
import type { FortState } from '../../data/types';
import { MODULE_LABEL, STAT_LABEL, titleTier } from '../../game/xp';
import { dateKey, formatDate } from '../../lib/date';
import {
  H, HERO_COOLDOWN, TRAITS, W, attackUnit, autoTurn, createBattle, enemyOrder, enemyStep, moveUnit, newRound, reachable, targetsFrom,
  unitAt, type BUnit, type Battle, type BattleEvent,
} from './battle';
import {
  BUILDINGS, CAMPS, ENEMIES, RES_FROM, RES_ICON, RES_LABEL, UNITS, armyCap, buildMinutes, buildingDef, campScale, type BuildingId,
  type Camp, type Res,
} from './data';
import {
  applyBattle, armySize, battleArmy, canOpenChest, canTrain, canUpgrade, collect, collectMult, collectorOf, defense, maxLevel, modifiers,
  openChest, speedUp, speedUpCost, startUpgrade, train, unlockedCamp, type LifeBuff, type Raid,
} from './economy';
import { BuildingSprite, PixelSprite, UNIT_SPRITES, UnitSprite } from './sprites';
import { checkFort, createFort, useFort, useNow, type FortCtx } from './useFort';

const TABS = [
  { path: '/fort', label: '🏰 Vesnice' },
  { path: '/fort/army', label: '⚔️ Armáda' },
  { path: '/fort/campaign', label: '🗺️ Výpravy' },
  { path: '/fort/log', label: '📜 Kronika' },
];
const RES_KEYS = ['wood', 'stone', 'crystal'] as const;
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, reduced() ? Math.min(ms, 120) : ms));

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
      {RES_KEYS.map((k) => (
        <span key={`${k}${Math.floor(bal[k])}`} title={RES_LABEL[k]} className="res">{RES_ICON[k]} <b>{Math.floor(bal[k]).toLocaleString('cs-CZ')}</b></span>
      ))}
    </div>
  );
}

function Cost({ cost, bal }: { cost: Res; bal: Res }) {
  return (
    <span className="small">
      {RES_KEYS.filter((k) => cost[k] > 0).map((k) => (
        <span key={k} style={{ marginRight: 8, color: bal[k] >= cost[k] ? undefined : 'var(--red)' }}>{RES_ICON[k]} {cost[k]}</span>
      ))}
    </span>
  );
}

function Buffs({ buffs }: { buffs: LifeBuff[] }) {
  if (!buffs.length) {
    return <p className="small muted" style={{ margin: '0 0 8px' }}>💡 Dnešní posílení: žádné. Trénink, učení nebo série dní dávají armádě bonusy do bitev.</p>;
  }
  return (
    <div className="buffs">
      {buffs.map((b) => <span key={b.id} className="buff" title={b.text}>{b.icon} {b.title}</span>)}
    </div>
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
        <div className="row" style={{ justifyContent: 'center', gap: 12, alignItems: 'flex-end' }}>
          <BuildingSprite id="hall" level={7} size={72} />
          <UnitSprite kind="warrior" size={40} />
          <UnitSprite kind="dragon" size={48} />
        </div>
        <p style={{ margin: 0 }}>Postav vesnici, vycvič armádu a vydej se na výpravy proti goblinům, orkům a nakonec drakovi.</p>
        <p className="small" style={{ margin: 0 }}>
          Suroviny vyrábí <b>tvoje skutečné úkoly</b>: 🪵 dřevo trénink a Ironman, 🪨 kámen učení a šachy, 💎 krystaly disciplína.
          Co v životě uděláš, objeví se ve vesnici jako bublina k sebrání.
        </p>
        <p className="small" style={{ margin: 0 }}>⚠️ Za každý den bez XP přijde nájezd. Hradby a věže ho můžou odrazit – jinak ti ukradnou část surovin.</p>
        <button className="primary btn-block" onClick={() => createFort()}>🏗️ Založit vesnici</button>
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
            <div className="row" style={{ gap: 8 }}>
              <UnitSprite kind={r.win ? 'warrior' : 'orc'} size={32} />
              <b>{formatDate(r.date)}: {r.win ? '🛡️ Nájezd odražen!' : '🔥 Vesnice vyrabována'}</b>
            </div>
            <div className="small muted">Síla nájezdníků {r.strength} · tvoje obrana {r.defense}</div>
            {!r.win && <div className="small" style={{ color: 'var(--red)' }}>Ukradeno: 🪵 {r.stolen.wood} · 🪨 {r.stolen.stone}</div>}
          </div>
        ))}
        <p className="small muted" style={{ margin: 0 }}>Nájezd přijde za každý den bez XP. Pomůžou vyšší Hradby, Obranná věž, větší armáda a Sklad.</p>
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
    <Modal open onClose={onClose} title={`${def.name} – level ${lvl}`}>
      <div className="stack">
        <div className="row" style={{ justifyContent: 'center', gap: 16, alignItems: 'flex-end' }}>
          <BuildingSprite id={id} level={lvl} size={80} />
          {!maxed && <span className="muted">→</span>}
          {!maxed && <BuildingSprite id={id} level={lvl + 1} size={80} />}
        </div>
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

/** Rozmístění budov ve vesnici (střed spodní hrany v % šířky a „výšky“ 0–115, šířka v %). */
const LAYOUT: Record<BuildingId, { x: number; y: number; w: number }> = {
  hall: { x: 50, y: 42, w: 30 },
  barracks: { x: 19, y: 34, w: 24 },
  forge: { x: 81, y: 34, w: 22 },
  academy: { x: 18, y: 61, w: 22 },
  tower: { x: 86, y: 63, w: 22 },
  storage: { x: 50, y: 70, w: 24 },
  sawmill: { x: 18, y: 92, w: 23 },
  quarry: { x: 50, y: 100, w: 22 },
  mine: { x: 82, y: 92, w: 22 },
  walls: { x: 50, y: 12, w: 16 },
};
const CHEST_POS = { x: 33, y: 52 };
const topPct = (y: number) => `${(y / 115) * 100}%`;

type Fly = { id: number; res: keyof Res; x: number; y: number; i: number };

function Village({ ctx, fort, onOpen }: { ctx: FortCtx; fort: FortState; onOpen: (id: BuildingId) => void }) {
  const now = useNow();
  const [fly, setFly] = useState<Fly[]>([]);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [shaking, setShaking] = useState(false);
  const [reward, setReward] = useState<Res | null>(null);
  const hour = new Date(now).getHours();
  const night = hour < 6 || hour >= 20;
  const today = dateKey();
  const chestReady = canOpenChest(fort, today, ctx.activeToday);
  const soldiers = UNITS.flatMap((u) => Array.from({ length: fort.army[u.id] }, () => u.id)).slice(0, 8);

  const show = (text: string) => {
    const id = Date.now();
    setToast({ id, text });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3500);
  };

  const gather = async (r: keyof Res) => {
    const amount = ctx.pend[r];
    if (!amount) return;
    const pos = LAYOUT[collectorOf(r)];
    const base = Date.now();
    setFly((f) => [...f, ...Array.from({ length: 6 }, (_, i) => ({ id: base + i, res: r, x: pos.x, y: pos.y - 20, i }))]);
    setTimeout(() => setFly((f) => f.filter((x) => x.id < base || x.id > base + 5)), 1200);
    // odkud suroviny jsou – podle modulů, kde se XP získalo
    const by = new Map<string, number>();
    for (const e of ctx.sources) if (RES_FROM[r].includes(e.stat)) by.set(e.module, (by.get(e.module) ?? 0) + e.amount);
    const parts = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([m, n]) => `${MODULE_LABEL[m as keyof typeof MODULE_LABEL]} ${Math.floor(n * collectMult(fort, r))}`);
    show(`${RES_ICON[r]} +${amount}${parts.length ? ` · ${parts.join(', ')}` : ''}`);
    await ctx.save(collect(fort, ctx.got, Date.now(), r));
  };

  const openTheChest = async () => {
    if (!chestReady) {
      show(fort.chestDay === today ? '🎁 Dnešní truhla už je otevřená – zítra další!' : '🔒 Získej dnes nějaké XP a truhla se otevře.');
      return;
    }
    setShaking(true);
    await sleep(800);
    const o = openChest(fort, today);
    await ctx.save(o.state);
    setShaking(false);
    setReward(o.reward);
  };

  return (
    <div className={`village ${night ? 'night' : ''}`}>
      <svg className="village-paths" viewBox="0 0 100 115" preserveAspectRatio="none" aria-hidden>
        <path d="M50 42 L19 34 M50 42 L81 34 M50 42 L50 70 L18 61 M50 70 L86 63 M50 70 L18 92 M50 70 L50 100 M50 70 L82 92 M50 42 L50 12"
          stroke="#8a6b3e" strokeWidth="5" strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" opacity="0.65" />
      </svg>
      {night && <div className="stars" aria-hidden />}
      <button className="v-walls" onClick={() => onOpen('walls')} aria-label={`Hradby level ${fort.buildings.walls}`}>
        {Array.from({ length: 6 }, (_, i) => <BuildingSprite key={i} id="walls" level={fort.buildings.walls} size={60} />)}
        <span className="v-name"><span className="v-lvl">{fort.buildings.walls}</span>Hradby{fort.upgrade?.id === 'walls' && ` 🔨 ${fmtTime(fort.upgrade.endsAt - now)}`}</span>
      </button>
      {BUILDINGS.filter((b) => b.id !== 'walls').map((b) => {
        const pos = LAYOUT[b.id];
        const up = fort.upgrade?.id === b.id ? fort.upgrade : null;
        const can = !up && canUpgrade(fort, b.id, ctx.bal).ok;
        const res = RES_KEYS.find((r) => collectorOf(r) === b.id);
        return (
          <div key={b.id} className="v-bld" style={{ left: `${pos.x}%`, top: topPct(pos.y), width: `${pos.w}%`, zIndex: Math.round(pos.y) }}>
            {res && ctx.pend[res] > 0 && (
              <button className="v-bubble" onClick={() => gather(res)} aria-label={`Sebrat ${RES_LABEL[res]}`}>{RES_ICON[res]} +{ctx.pend[res]}</button>
            )}
            <button className="v-img" onClick={() => onOpen(b.id)} aria-label={`${b.name} level ${fort.buildings[b.id]}`}>
              <BuildingSprite id={b.id} level={fort.buildings[b.id]} size={200} />
              {up && <span className="v-scaffold"><PixelSprite rows={UNIT_SPRITES.scaffold} size={200} /></span>}
              {up && <span className="v-hammer">🔨</span>}
            </button>
            <span className="v-name"><span className="v-lvl">{fort.buildings[b.id]}</span>{b.name}{can && <span className="v-up">⬆</span>}</span>
            {up && <span className="v-timer">{fmtTime(up.endsAt - now)}</span>}
          </div>
        );
      })}
      <button className={`v-chest ${chestReady ? 'ready' : 'locked'} ${shaking ? 'shake' : ''}`} style={{ left: `${CHEST_POS.x}%`, top: topPct(CHEST_POS.y) }}
        onClick={openTheChest} aria-label="Denní truhla">
        <PixelSprite rows={UNIT_SPRITES.chest} size={36} />
      </button>
      <div className="v-hero" style={{ left: '58%', top: topPct(52) }}><PixelAvatar tier={titleTier(ctx.heroLevel)} size={30} /></div>
      {soldiers.map((k, i) => (
        <div key={i} className="v-soldier" style={{ left: `${6 + (i % 4) * 7}%`, top: topPct(42 + Math.floor(i / 4) * 6), animationDelay: `${i * 0.23}s` }}>
          <UnitSprite kind={k} size={18} />
        </div>
      ))}
      {[0, 1, 2].map((i) => (
        <div key={i} className={`v-walker w${i}`} aria-hidden>
          <PixelSprite rows={UNIT_SPRITES.villager} pal={{ B: ['#2563eb', '#16a34a', '#b45309'][i] }} size={12} />
        </div>
      ))}
      {fly.map((f) => (
        <span key={f.id} className="v-fly" style={{ left: `${f.x + (f.i - 2.5) * 2.5}%`, top: topPct(f.y), animationDelay: `${f.i * 70}ms` }}>{RES_ICON[f.res]}</span>
      ))}
      {toast && <div className="v-toast" key={toast.id}>{toast.text}</div>}
      <Modal open={!!reward} onClose={() => setReward(null)} title="🎁 Denní truhla">
        {reward && (
          <div className="stack" style={{ alignItems: 'center' }}>
            <span className="chest-pop"><PixelSprite rows={UNIT_SPRITES.chestOpen} size={90} /></span>
            <ResBar bal={reward} />
            <p className="small muted" style={{ margin: 0 }}>Zítra čeká další – stačí získat aspoň nějaké XP.</p>
            <button className="primary btn-block" onClick={() => setReward(null)}>Super!</button>
          </div>
        )}
      </Modal>
    </div>
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
    if (fort.upgrade && now >= fort.upgrade.endsAt) checkFort();
  }, [now, fort.upgrade]);
  const m = modifiers(fort);
  const pendTotal = ctx.pend.wood + ctx.pend.stone + ctx.pend.crystal;
  return (
    <div>
      <Header ctx={ctx} active="/fort" />
      <Buffs buffs={ctx.buffs} />
      <Village ctx={ctx} fort={fort} onOpen={setOpen} />
      <section className="panel small">
        <div>
          🔨 Stavitel: {fort.upgrade ? <b>staví {buildingDef(fort.upgrade.id).name} (zbývá {fmtTime(fort.upgrade.endsAt - now)})</b> : <b style={{ color: 'var(--green)' }}>volný – klepni na budovu</b>}
        </div>
        <div style={{ marginTop: 6 }}>
          ⚔️ Armáda {armySize(fort)}/{armyCap(fort.buildings.barracks)} · 🗡️ útok +{Math.round((m.atk - 1) * 100)} % · ❤️ životy +{Math.round((m.hp - 1) * 100)} % · 🛡️ obrana {defense(fort)}
        </div>
        {pendTotal === 0 && <div className="muted" style={{ marginTop: 6 }}>Nové suroviny se objeví v bublinách nad Pilou, Kamenolomem a Dolem, až v životě něco splníš.</div>}
        {!ctx.activeToday && <div style={{ marginTop: 6, color: 'var(--red)' }}>⚠️ Dnes ještě nemáš XP – v noci hrozí nájezd.</div>}
      </section>
      <BuildingModal ctx={ctx} fort={fort} id={open} onClose={() => setOpen(null)} />
      <RaidReport raids={raids} onClose={() => setRaids([])} />
    </div>
  );
}

function FortArmy({ ctx, fort }: { ctx: FortCtx; fort: FortState }) {
  const m = modifiers(fort);
  const hero = battleArmy(fort, ctx.heroLevel, ctx.buffs)[0].stats;
  return (
    <div>
      <Header ctx={ctx} active="/fort/army" />
      <p className="small">Armáda {armySize(fort)} / {armyCap(fort.buildings.barracks)} vojáků. Padlí v bitvě se musí vycvičit znovu, hrdina se vždy vrátí.</p>
      <MiniBar value={armySize(fort) / armyCap(fort.buildings.barracks)} color="var(--m-fort)" />
      <div style={{ marginTop: 10 }}><Buffs buffs={ctx.buffs} /></div>
      <section className="panel row" style={{ gap: 10 }}>
        <PixelAvatar tier={titleTier(ctx.heroLevel)} size={48} />
        <div className="grow">
          <b>Hrdina (level {ctx.heroLevel})</b>
          <div className="small muted">❤️ {hero.hp} · 🗡️ {hero.atk} · 👣 {hero.move} · 🎯 {hero.range}</div>
          <div className="small">{TRAITS.hero}</div>
        </div>
      </section>
      {UNITS.map((u) => {
        const check = canTrain(fort, u.id, ctx.bal, ctx.statLevels);
        return (
          <section key={u.id} className="panel">
            <div className="row" style={{ gap: 10 }}>
              <UnitSprite kind={u.id} size={44} />
              <div className="grow">
                <b>{u.name}</b> <span className="pixel" style={{ color: 'var(--m-fort)' }}>×{fort.army[u.id]}</span>
                <div className="small muted">❤️ {Math.round(u.hp * m.hp)} · 🗡️ {Math.round(u.atk * m.atk)} · 👣 {u.move} · 🎯 {u.range}</div>
              </div>
              <button className="primary" disabled={!check.ok} onClick={() => ctx.save(train(fort, u.id, ctx.bal, ctx.statLevels))}>+ Vycvičit</button>
            </div>
            <div className="small" style={{ marginTop: 6 }}>{u.text} {TRAITS[u.id]}</div>
            <div style={{ marginTop: 4 }}><Cost cost={u.cost} bal={ctx.bal} /></div>
            {u.stat && <div className="small muted">Odemyká: Kasárna {u.barracks} + {STAT_LABEL[u.stat.id]} level {u.stat.level} (máš {ctx.statLevels[u.stat.id]})</div>}
            {!check.ok && <div className="small muted">🔒 {check.reason}</div>}
          </section>
        );
      })}
    </div>
  );
}

function CampModal({ ctx, fort, camp, onClose }: { ctx: FortCtx; fort: FortState; camp: Camp | null; onClose: () => void }) {
  if (!camp) return null;
  const k = campScale(camp.id);
  const done = (fort.camps[camp.id] ?? 0) > 0;
  const counts = camp.enemies.reduce<Record<string, number>>((a, e) => ({ ...a, [e]: (a[e] ?? 0) + 1 }), {});
  return (
    <Modal open onClose={onClose} title={`${camp.icon} ${camp.id}. ${camp.name}`}>
      <div className="stack">
        {Object.entries(counts).map(([id, n]) => {
          const e = ENEMIES[id as keyof typeof ENEMIES];
          return (
            <div key={id} className="row" style={{ gap: 8 }}>
              <UnitSprite kind={id} size={30} />
              <div className="small grow">
                <b>{e.name} ×{n}</b> <span className="muted">❤️ {Math.round(e.hp * k.hp)} · 🗡️ {Math.round(e.atk * k.atk)} · 🎯 {e.range}</span>
                {TRAITS[id] && <div className="muted">{TRAITS[id]}</div>}
              </div>
            </div>
          );
        })}
        <div className="small"><b>Kořist:</b> 🪵 {camp.loot.wood} · 🪨 {camp.loot.stone} · 💎 {camp.loot.crystal}{done ? ' (opakovaně 40 %)' : ' + 💎 10 za první dobytí'}</div>
        <Buffs buffs={ctx.buffs} />
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
          const boss = c.enemies.reduce((a, e) => (ENEMIES[e].hp > ENEMIES[a].hp ? e : a), c.enemies[0]);
          return (
            <button key={c.id} className={`camp ${locked ? 'locked' : ''} ${c.id === next ? 'next' : ''}`} disabled={locked} onClick={() => setOpen(c)}>
              <span className="camp-ic">{locked ? <span style={{ fontSize: '1.6rem' }}>🔒</span> : <UnitSprite kind={boss} size={40} />}</span>
              <span className="grow" style={{ textAlign: 'left' }}>
                <b>{c.id}. {c.name}</b>
                <span className="small muted" style={{ display: 'block' }}>{c.enemies.length} nepřátel · kořist 🪵 {c.loot.wood} 🪨 {c.loot.stone}</span>
              </span>
              <span className="stars">{[1, 2, 3].map((i) => (i <= st ? '⭐' : '☆')).join('')}</span>
            </button>
          );
        })}
      </div>
      <CampModal ctx={ctx} fort={fort} camp={open} onClose={() => setOpen(null)} />
    </div>
  );
}

// ---------- bitva ----------

const BATTLE_KEY = 'questy.fort.battle';
function loadBattle(campId: number): Battle | null {
  try {
    const x = JSON.parse(localStorage.getItem(BATTLE_KEY) ?? 'null') as { campId: number; battle: Battle } | null;
    return x && x.campId === campId && !x.battle.over && Array.isArray(x.battle.events) ? x.battle : null;
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

type FxItem = { key: string; kind: 'shot' | 'num' | 'burst'; fx?: string; from?: { x: number; y: number }; at: { x: number; y: number }; text?: string; tone?: string; delay: number };
const cellPct = (v: number, n: number) => `${((v + 0.5) / n) * 100}%`;
const FX_ICON: Record<string, string> = { arrow: '➶', magic: '✨', fire: '🔥', strike: '💥', melee: '⚔️' };

function FortBattle({ ctx, fort, campId }: { ctx: FortCtx; fort: FortState; campId: number }) {
  const camp = CAMPS.find((c) => c.id === campId);
  const [b, setB] = useState<Battle | null>(() => (camp ? loadBattle(campId) ?? createBattle(battleArmy(fort, ctx.heroLevel, ctx.buffs), camp) : null));
  const [sel, setSel] = useState<string | null>(null);
  const [power, setPower] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fx, setFx] = useState<FxItem[]>([]);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState<{ stars: number; loot: Res; first: boolean; fallen: string[] } | null>(null);
  const finished = useRef(false);
  const seen = useRef(b?.events.length ?? 0);
  const bRef = useRef(b);
  bRef.current = b;
  const tier = titleTier(ctx.heroLevel);

  // nové události → animace (střely, čísla poškození, výbuchy)
  useEffect(() => {
    if (!b) return;
    const fresh = b.events.slice(seen.current);
    seen.current = b.events.length;
    if (!fresh.length) return;
    const pos = (id: string) => {
      const u = b.units.find((v) => v.id === id)!;
      return { x: u.x, y: u.y };
    };
    const items: FxItem[] = [];
    let delay = 0;
    fresh.forEach((e: BattleEvent, i) => {
      const k = `${b.events.length}-${i}`;
      if (e.t === 'move') delay = 260;
      if (e.t === 'hit') {
        const ranged = e.fx !== 'melee' && e.fx !== 'strike';
        const hitAt = delay + (ranged ? 300 : 80);
        if (ranged) items.push({ key: `s${k}`, kind: 'shot', fx: e.fx, from: pos(e.id), at: pos(e.target), delay });
        items.push({ key: `b${k}`, kind: 'burst', fx: e.fx, at: pos(e.target), delay: hitAt });
        items.push({
          key: `n${k}`, kind: 'num', at: pos(e.target), delay: hitAt,
          text: `${e.crit ? 'KRIT! ' : ''}${e.note ? `${e.note} ` : ''}−${e.dmg}`, tone: e.crit || e.fx === 'strike' ? 'crit' : 'dmg',
        });
        if (e.fx === 'strike' || e.crit) {
          setTimeout(() => {
            setShake(true);
            setTimeout(() => setShake(false), 320);
          }, hitAt);
        }
      }
      if (e.t === 'heal') items.push({ key: `h${k}`, kind: 'num', at: pos(e.id), text: `+${e.amount}`, tone: 'heal', delay });
    });
    setFx((f) => [...f, ...items]);
    const keys = new Set(items.map((x) => x.key));
    setTimeout(() => setFx((f) => f.filter((x) => !keys.has(x.key))), 1500 + delay);
  }, [b]);

  useEffect(() => {
    if (camp && b) storeBattle(campId, b);
    if (!camp || !b?.over || finished.current) return;
    finished.current = true;
    const r = applyBattle(fort, camp, b);
    const lost = b.units.filter((u) => u.side === 'me' && u.hp <= 0 && u.kind !== 'hero').map((u) => u.kind);
    (async () => {
      await sleep(1000);
      setResult({ stars: r.stars, loot: r.loot, first: r.first, fallen: lost });
      await ctx.save(r.state);
      await store.col('fortLog').put({
        id: `battle:${Date.now()}`, ts: Date.now(), date: dateKey(), kind: 'battle', win: r.stars > 0, stars: r.stars,
        title: `${camp.icon} ${camp.name}`, res: r.loot,
      });
    })();
  }, [b, camp, campId, fort, ctx]);

  /** Tah nepřátel – jeden po druhém, ať je vidět, co se děje. */
  const enemyTurn = useCallback(async () => {
    let cur = bRef.current;
    if (!cur || cur.over) return;
    setBusy(true);
    setSel(null);
    setPower(false);
    for (const id of enemyOrder(cur)) {
      const next = enemyStep(cur, id);
      if (next !== cur) {
        cur = next;
        setB(cur);
        await sleep(560);
      }
      if (cur.over) break;
    }
    cur = newRound(cur);
    setB(cur);
    setBusy(false);
  }, []);

  if (!camp || !b) return <Empty>Výprava nenalezena. <a href="#/fort/campaign">Zpět</a></Empty>;
  if (camp.id > unlockedCamp(fort) && !result) return <Empty>Tahle výprava je ještě zamčená. <a href="#/fort/campaign">Zpět</a></Empty>;

  const selected = b.units.find((u) => u.id === sel && u.hp > 0) ?? null;
  const mine = selected?.side === 'me';
  const moves = mine && !selected!.moved ? reachable(b, selected!) : [];
  const targets = mine && !selected!.acted ? targetsFrom(b, selected!) : [];
  const rocks = new Set(b.rocks);
  const myLeft = b.units.filter((u) => u.side === 'me' && u.hp > 0 && !u.acted).length;
  const canPower = !!mine && selected!.kind === 'hero' && selected!.cd === 0 && !selected!.acted;

  const tap = (x: number, y: number) => {
    if (b.over || busy) return;
    const u = unitAt(b, x, y);
    if (selected && u && u.side === 'foe' && targets.some((t) => t.id === u.id)) {
      setB(attackUnit(b, selected.id, u.id, power && canPower));
      setSel(null);
      setPower(false);
      return;
    }
    if (selected && !u && moves.some((p) => p.x === x && p.y === y) && (selected.x !== x || selected.y !== y)) {
      setB(moveUnit(b, selected.id, x, y));
      return;
    }
    setPower(false);
    setSel(u ? u.id : null);
  };

  const unitView = (u: BUnit) => (
    <div key={u.id} className={`b-unit ${u.side} ${u.hp <= 0 ? 'dead' : ''} ${u.id === sel ? 'sel' : ''} ${u.side === 'me' && u.acted && u.hp > 0 ? 'done' : ''}`}
      style={{ left: `${(u.x / W) * 100}%`, top: `${(u.y / H) * 100}%`, width: `${100 / W}%`, height: `${100 / H}%` }}>
      <span className="spr">{u.kind === 'hero' ? <PixelAvatar tier={tier} size={30} /> : <UnitSprite kind={u.kind} size={28} />}</span>
      <span className="hp"><span style={{ width: `${(u.hp / u.maxHp) * 100}%` }} /></span>
      {u.kind === 'hero' && u.cd === 0 && u.hp > 0 && <span className="ready">⚡</span>}
    </div>
  );

  return (
    <div>
      <h1 style={{ margin: 0 }}>{camp.icon} {camp.name}</h1>
      <div className="small" style={{ margin: '2px 0 6px', color: busy ? 'var(--red)' : 'var(--muted)' }}>{busy ? '👹 Táhne nepřítel…' : `Tah ${b.turn} · tvůj tah`}</div>
      <Buffs buffs={ctx.buffs} />
      <div className={`battlefield ${shake ? 'shake' : ''}`}>
        <div className="battle-grid" style={{ gridTemplateColumns: `repeat(${W}, 1fr)` }}>
          {Array.from({ length: W * H }, (_, i) => {
            const x = i % W;
            const y = Math.floor(i / W);
            const u = unitAt(b, x, y);
            const isMove = !u && moves.some((p) => p.x === x && p.y === y);
            const isTarget = !!u && targets.some((t) => t.id === u.id);
            const cls = ['cell', (x + y) % 2 ? 'alt' : '', rocks.has(`${x},${y}`) ? 'rock' : '', isMove ? 'move' : '', isTarget ? (power ? 'target power' : 'target') : ''].join(' ');
            return (
              <button key={i} className={cls} onClick={() => tap(x, y)} aria-label={u ? `${u.name} ${u.hp}/${u.maxHp}` : `pole ${x + 1},${y + 1}`}>
                {rocks.has(`${x},${y}`) && <span className="ic">{(x * 3 + y) % 2 ? '🌲' : '🪨'}</span>}
              </button>
            );
          })}
        </div>
        <div className="b-units">{b.units.map(unitView)}</div>
        <div className="b-fx" aria-hidden>
          {fx.map((f) => f.kind === 'shot' ? (
            <span key={f.key} className={`shot ${f.fx}`} style={{
              left: cellPct(f.from!.x, W), top: cellPct(f.from!.y, H), animationDelay: `${f.delay}ms`,
              ['--dx' as string]: `${((f.at.x - f.from!.x) / W) * 100}cqw`, ['--dy' as string]: `${((f.at.y - f.from!.y) / H) * 100}cqh`,
            }}>{FX_ICON[f.fx!]}</span>
          ) : f.kind === 'burst' ? (
            <span key={f.key} className={`burst ${f.fx}`} style={{ left: cellPct(f.at.x, W), top: cellPct(f.at.y, H), animationDelay: `${f.delay}ms` }}>{f.fx === 'melee' ? '💢' : FX_ICON[f.fx!]}</span>
          ) : (
            <span key={f.key} className={`num ${f.tone}`} style={{ left: cellPct(f.at.x, W), top: cellPct(f.at.y, H), animationDelay: `${f.delay}ms` }}>{f.text}</span>
          ))}
        </div>
      </div>
      <div className="small battle-info">
        {selected ? (
          <>
            <b>{selected.name}</b> ❤️ {selected.hp}/{selected.maxHp} · 🗡️ {selected.atk} · 👣 {selected.move} · 🎯 {selected.range}
            {TRAITS[selected.kind] && <div className="muted">{TRAITS[selected.kind]}{selected.kind === 'hero' && selected.cd > 0 ? ` – připraveno za ${selected.cd} ${selected.cd === 1 ? 'kolo' : 'kola'}` : ''}</div>}
            {mine && <div className="muted">{selected.acted ? 'Už táhl.' : selected.moved ? 'Teď klepni na nepřítele v červeném rámečku.' : 'Modrá pole = kam může jít. Červený rámeček = na koho dosáhne.'}</div>}
          </>
        ) : (
          <span className="muted">Klepni na svou jednotku. Táhnout ještě může: {myLeft}. Až budeš hotový, dej „Konec tahu“.</span>
        )}
      </div>
      {canPower && targets.length > 0 && (
        <button className={`btn-block ${power ? 'btn-gold' : ''}`} style={{ marginTop: 6 }} onClick={() => setPower(!power)}>
          {power ? '⚡ Mocný úder připraven – klepni na cíl' : `⚡ Mocný úder (dvojnásobné poškození, nabití ${HERO_COOLDOWN} kola)`}
        </button>
      )}
      <div className="grid3" style={{ marginTop: 8 }}>
        <button onClick={() => { setB(autoTurn(b)); setSel(null); }} disabled={!!b.over || busy}>⚡ Auto</button>
        <button className="primary" onClick={enemyTurn} disabled={!!b.over || busy}>Konec tahu ›</button>
        <button className="btn-danger" disabled={!!b.over || busy} onClick={() => confirm('Vzdát bitvu? Padlé jednotky budou ztracené.') && setB({ ...b, over: 'lose' })}>Vzdát</button>
      </div>
      <div className="battle-log small">
        {b.log.slice(-4).map((l, i) => <div key={b.log.length - 4 + i}>{l}</div>)}
      </div>
      <Modal open={!!result} onClose={() => navigate('/fort/campaign')} title={result && result.stars ? '🏆 Vítězství!' : '💀 Porážka'}>
        {result && (
          <div className="stack">
            {result.stars > 0 && <div className="result-stars">{[1, 2, 3].map((i) => <span key={i} className={i <= result.stars ? 'on' : ''} style={{ animationDelay: `${i * 250}ms` }}>⭐</span>)}</div>}
            {result.stars > 0 && <ResBar bal={result.loot} />}
            {result.first && <p className="small" style={{ margin: 0, color: 'var(--gold)' }}>První dobytí – bonus 💎 10 a odemčena další výprava!</p>}
            {result.fallen.length > 0 ? (
              <div className="row small" style={{ gap: 6, flexWrap: 'wrap' }}>Padli: {result.fallen.map((k, i) => <UnitSprite key={i} kind={k} size={22} />)} – vycvič nové v Armádě.</div>
            ) : <p className="small" style={{ margin: 0 }}>Nikdo nepadl. 💪</p>}
            {!result.stars && <p className="small muted" style={{ margin: 0 }}>Tip: vylepši Kovárnu a Akademii, vycvič silnější jednotky, drž lučištníky za válečníky – a před bitvou si dej trénink nebo matiku (posílení!).</p>}
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
            {RES_KEYS.filter((k) => l.res[k]).map((k) => (
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
