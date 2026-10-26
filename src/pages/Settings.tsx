import { useRef, useState } from 'react';
import { game, store, useProfile } from '../app/context';
import { backupNow } from '../app/backup';
import { buildTime } from '../app/updates';
import { ensureSeed } from '../app/seed';
import type { Backup } from '../data/store';
import type { MathLevel, ModuleId } from '../data/types';
import { MODULES } from '../game/xp';
import { dateKey } from '../lib/date';
import { LEVEL_LABEL } from '../modules/math/topics';

export default function Settings() {
  const p = useProfile();
  const [name, setName] = useState(p.name);
  const [chess, setChess] = useState(p.chessUsername);
  const [proxy, setProxy] = useState(p.chessProxyUrl);
  const [server, setServer] = useState(p.serverUrl);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    await game.saveProfile({
      name: name.trim() || 'Hrdina', chessUsername: chess.trim(), chessProxyUrl: proxy.trim(),
      serverUrl: server.trim().replace(/[.\s/]+$/, ''),
    });
    setMsg('Uloženo ✓');
  };

  const exportBackup = async () => {
    const backup = await store.exportAll();
    const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `questy-zaloha-${dateKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    await store.col('meta').put({ id: 'lastBackup', value: Date.now() });
    setMsg('Záloha stažena ✓');
  };

  const importBackup = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Backup;
      if (!confirm('Import přepíše všechna současná data. Pokračovat?')) return;
      await store.importAll(data);
      await ensureSeed();
      setMsg('Záloha obnovena ✓');
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      setMsg(`Import selhal: ${(e as Error).message}`);
    }
  };

  const reset = async () => {
    if (!confirm('Opravdu smazat VŠECHNA data? Doporučuji nejdřív export zálohy.')) return;
    if (!confirm('Poslední varování – smazat?')) return;
    await store.wipe();
    location.reload();
  };

  return (
    <div>
      <h1>Nastavení</h1>
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Postava</h2>
        <div className="field">
          <label>Jméno</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Úroveň matematiky</label>
          <select value={p.mathLevel} onChange={(e) => game.saveProfile({ mathLevel: e.target.value as MathLevel })}>
            {(Object.keys(LEVEL_LABEL) as MathLevel[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Datum přijímaček / maturity</label>
          <input type="date" value={p.examDate} onChange={(e) => game.saveProfile({ examDate: e.target.value })} />
        </div>
        <h2>Server (Vercel)</h2>
        <div className="field">
          <label>Adresa tvého Vercel serveru – pro videa z YouTube (a proxy). Když je prázdná, vezme se z Financí.</label>
          <input value={server} onChange={(e) => setServer(e.target.value)} placeholder="https://life-xxxx.vercel.app" autoCapitalize="none" />
        </div>
        <h2>Chess.com</h2>
        <div className="field">
          <label>Uživatelské jméno</label>
          <input value={chess} onChange={(e) => setChess(e.target.value)} autoCapitalize="none" autoCorrect="off" />
        </div>
        <div className="field">
          <label>Proxy URL (nepovinné, jen když přímé volání API nefunguje)</label>
          <input value={proxy} onChange={(e) => setProxy(e.target.value)} placeholder="https://tvoje-app.vercel.app/api/chess" />
        </div>
        <button className="primary btn-block" onClick={save}>Uložit</button>
        {msg && <p className="center small" style={{ color: 'var(--green)' }}>{msg}</p>}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Spodní lišta</h2>
        <p className="small muted">Vyber až 4 sekce, které chceš mít dole. Ostatní najdeš pod „⋯ Více“.</p>
        <div className="row wrap" style={{ gap: 6 }}>
          {MODULES.map((m) => {
            const on = p.navPinned.includes(m.id);
            const toggle = () => {
              const next: ModuleId[] = on ? p.navPinned.filter((x) => x !== m.id) : [...p.navPinned, m.id];
              if (next.length <= 4) game.saveProfile({ navPinned: next });
            };
            return (
              <button key={m.id} className={`chip ${on ? 'on' : ''}`} onClick={toggle} disabled={!on && p.navPinned.length >= 4}>
                {m.icon} {m.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Záloha dat</h2>
        <button className="primary btn-block" style={{ marginBottom: 10 }} onClick={async () => { if (await backupNow()) setMsg('Záloha hotová ✓'); }}>
          ☁️ Zálohovat teď (Google Disk, e‑mail…)
        </button>
        <p className="small muted">Data jsou uložená jen v tomto zařízení (IndexedDB). Pravidelně si stahuj zálohu.</p>
        <div className="grid2">
          <button onClick={exportBackup}>⬇ Export (JSON)</button>
          <button onClick={() => fileRef.current?.click()}>⬆ Import</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = ''; }} />
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Nebezpečná zóna</h2>
        <button className="btn-danger btn-block" onClick={reset}>Smazat všechna data</button>
      </section>
      <p className="center small muted">
        Questy života · verze {buildTime()?.toLocaleString('cs-CZ') ?? '?'}<br />
        Aktualizace se stahují samy – stačí appku občas zavřít a znovu otevřít.
      </p>
    </div>
  );
}
