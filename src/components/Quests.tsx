import { useState } from 'react';
import { game, store } from '../app/context';
import type { CustomQuest, Difficulty, ModuleId, Recurrence, StatId } from '../data/types';
import { uid } from '../lib/date';
import type { QuestView } from '../game/quests';
import { DIFFICULTY_LABEL, DIFFICULTY_XP, MODULES, MODULE_LABEL, STATS, STAT_LABEL } from '../game/xp';
import { Modal } from './ui';

const MODULE_ICON: Record<ModuleId, string> = { core: '⚔️', math: '∑', training: '🏋️', chess: '♞', discover: '🔭' };
const REC_LABEL: Record<Recurrence, string> = { once: 'Jednorázový', daily: 'Denní', weekly: 'Týdenní' };

export function QuestRow({ q }: { q: QuestView }) {
  const [busy, setBusy] = useState(false);
  const tick = async () => {
    setBusy(true);
    try {
      if (q.done) {
        if (confirm(`Vrátit splnění questu „${q.title}“? XP se odečte.`)) await game.undoQuest(q.id);
      } else await game.progressQuest(q.id);
    } finally {
      setBusy(false);
    }
  };
  const archive = async () => {
    if (!confirm(`Smazat vlastní quest „${q.title}“?`)) return;
    const c = await store.col('quests').get(q.id);
    if (c) await store.col('quests').put({ ...c, archived: true });
  };
  return (
    <div className={`quest ${q.done ? 'done' : ''}`}>
      {q.manual ? (
        <button className={`qcheck ${q.done ? 'on' : ''}`} onClick={tick} disabled={busy} aria-label={q.done ? 'Vrátit' : 'Splnit'}>
          {q.done ? '✓' : q.target > 1 ? '+' : ''}
        </button>
      ) : (
        <div className="qicon" aria-hidden>{q.done ? '✅' : MODULE_ICON[q.module]}</div>
      )}
      <div className="grow">
        {q.route && !q.done ? (
          <a href={`#${q.route}`} className="qtitle" style={{ color: 'var(--text)', textDecoration: 'none' }}>{q.title} ›</a>
        ) : (
          <div className="qtitle">{q.title}</div>
        )}
        <div className="qmeta">
          {REC_LABEL[q.recurrence]} · {DIFFICULTY_LABEL[q.difficulty]} · {STAT_LABEL[q.stat]}
          {q.target > 1 && <> · <b style={{ color: 'var(--gold-2)' }}>{q.count}/{q.target}</b></>}
          {q.description && !q.done && <><br />{q.description}</>}
        </div>
      </div>
      <div className="row" style={{ gap: 4 }}>
        <span className="xp-chip">+{DIFFICULTY_XP[q.difficulty]}</span>
        {q.custom && <button className="iconbtn btn-sm" onClick={archive} aria-label="Smazat quest">🗑</button>}
        {!q.done && q.manual && q.count > 0 && (
          <button className="iconbtn btn-sm" onClick={() => game.undoQuest(q.id)} aria-label="Vrátit krok">↩</button>
        )}
      </div>
    </div>
  );
}

export function QuestList({ quests, empty = 'Žádné questy.' }: { quests: QuestView[]; empty?: string }) {
  if (!quests.length) return <div className="empty">{empty}</div>;
  const sorted = [...quests].sort((a, b) => Number(a.done) - Number(b.done));
  return <div>{sorted.map((q) => <QuestRow key={q.id} q={q} />)}</div>;
}

export function AddQuestModal({ open, onClose, module = 'core' }: { open: boolean; onClose: () => void; module?: ModuleId }) {
  const [title, setTitle] = useState('');
  const [mod, setMod] = useState<ModuleId>(module);
  const [stat, setStat] = useState<StatId>('dis');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [recurrence, setRecurrence] = useState<Recurrence>('daily');
  const [target, setTarget] = useState(1);

  const save = async () => {
    if (!title.trim()) return;
    const q: CustomQuest = {
      id: `custom-${uid()}`, title: title.trim(), module: mod, stat, difficulty, recurrence,
      target: Math.max(1, Math.round(target || 1)), createdAt: Date.now(),
    };
    await store.col('quests').put(q);
    setTitle('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nový quest">
      <div className="field">
        <label>Název</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="např. Přečti 20 stran" autoFocus />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Typ</label>
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
            {(['daily', 'weekly', 'once'] as Recurrence[]).map((r) => <option key={r} value={r}>{REC_LABEL[r]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Kolikrát za období</label>
          <input type="number" min={1} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Obtížnost</label>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            {(Object.keys(DIFFICULTY_XP) as Difficulty[]).map((d) => (
              <option key={d} value={d}>{DIFFICULTY_LABEL[d]} ({DIFFICULTY_XP[d]} XP)</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Statistika</label>
          <select value={stat} onChange={(e) => setStat(e.target.value as StatId)}>
            {STATS.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Modul</label>
        <select value={mod} onChange={(e) => setMod(e.target.value as ModuleId)}>
          <option value="core">{MODULE_LABEL.core}</option>
          {MODULES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
      <button className="primary btn-block" onClick={save} disabled={!title.trim()}>Přidat quest</button>
    </Modal>
  );
}
