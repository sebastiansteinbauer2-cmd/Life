import { useState } from 'react';
import { useProfile } from '../app/context';
import { serverBase } from '../modules/discover/videos';
import { useSyncStatus } from '../sync/SyncPanel';
import { disablePush, enablePush, loadPush, pushSupported, testPush } from './push';
import { PUSH_SQL_1, PUSH_SQL_2 } from './sql';

const EVENING = [17, 18, 19, 20, 21, 22];
const MORNING = [5, 6, 7, 8, 9, 10];

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn-sm" onClick={async () => {
      try {
        await navigator.clipboard.writeText(text);
        setDone(true);
      } catch { /* nevadí */ }
    }}>{done ? 'Zkopírováno ✓' : label}</button>
  );
}

function Guide() {
  return (
    <details className="small">
      <summary>📖 Návod – jednorázové nastavení v Supabase (2 minuty)</summary>
      <ol style={{ paddingLeft: 18 }}>
        <li>V Supabase otevři <b>SQL Editor</b>, vymaž editor, vlož <b>1. část</b> a dej <b>Run</b> (má napsat Success).
          <div className="row" style={{ margin: '6px 0' }}><CopyButton text={PUSH_SQL_1} label="📋 Zkopírovat 1. část" /></div>
        </li>
        <li>Editor znovu vymaž, vlož <b>2. část</b> a dej <b>Run</b>.
          <div className="row" style={{ margin: '6px 0' }}><CopyButton text={PUSH_SQL_2} label="📋 Zkopírovat 2. část" /></div>
        </li>
        <li>Pozor: editor na tabletu občas sám přidá na konec <code>)</code> nebo <code>$$</code> – před Run je smaž.</li>
        <li>Pak tady zapni připomínky a dej <b>Vyzkoušet</b>.</li>
      </ol>
    </details>
  );
}

/** Nastavení připomínek (Nastavení → Připomínky). */
export default function PushPanel() {
  const p = useProfile();
  const sync = useSyncStatus();
  const saved = loadPush();
  const [evening, setEvening] = useState<number | null>(saved.evening);
  const [morning, setMorning] = useState<number | null>(saved.morning);
  const [enabled, setEnabled] = useState(saved.enabled);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const extra = { relay: serverBase(p), name: p.name };

  if (!pushSupported()) {
    return <p className="small muted">Tento prohlížeč notifikace neumí. Na Androidu otevři appku v Chrome a nainstaluj si ji na plochu.</p>;
  }
  if (sync.state === 'off' || sync.state === 'login' || sync.state === 'unlinked') {
    return <p className="small muted">Připomínky posílá tvůj cloud, i když je appka zavřená. Nejdřív proto zapni <b>Synchronizaci zařízení</b> (výš).</p>;
  }

  return (
    <div className="stack">
      <p className="small muted">Připomínky chodí, i když je appka zavřená. Večerní přijde jen tehdy, když ten den ještě nemáš žádný quest.</p>
      <Guide />
      <div className="field">
        <label>🔥 Večer – když série hrozí, že se přeruší</label>
        <div className="row wrap" style={{ gap: 6 }}>
          <button className={`chip ${evening === null ? 'on' : ''}`} onClick={() => setEvening(null)}>Vypnuto</button>
          {EVENING.map((h) => <button key={h} className={`chip ${evening === h ? 'on' : ''}`} onClick={() => setEvening(h)}>{h}:00</button>)}
        </div>
      </div>
      <div className="field">
        <label>☀️ Ráno – motivace na začátek dne</label>
        <div className="row wrap" style={{ gap: 6 }}>
          <button className={`chip ${morning === null ? 'on' : ''}`} onClick={() => setMorning(null)}>Vypnuto</button>
          {MORNING.map((h) => <button key={h} className={`chip ${morning === h ? 'on' : ''}`} onClick={() => setMorning(h)}>{h}:00</button>)}
        </div>
      </div>
      <button className="primary btn-block" disabled={busy || (evening === null && morning === null)}
        onClick={() => run(async () => { await enablePush({ evening, morning }, extra); setEnabled(true); }, 'Připomínky zapnuté ✓ Dej Vyzkoušet, ať víš, že to funguje.')}>
        🔔 {enabled ? 'Uložit připomínky' : 'Zapnout připomínky'}
      </button>
      {enabled && (
        <div className="grid2">
          <button disabled={busy} onClick={() => run(testPush, 'Odesláno – notifikace by měla přijít do pár sekund.')}>Vyzkoušet</button>
          <button disabled={busy} onClick={() => run(async () => { await disablePush(); setEnabled(false); }, 'Připomínky na tomto zařízení vypnuté.')}>Vypnout</button>
        </div>
      )}
      {busy && <p className="small muted">Moment…</p>}
      {msg && <p className="small" style={{ color: msg.ok ? 'var(--green)' : 'var(--red)' }}>{msg.text}</p>}
    </div>
  );
}
