import { useEffect, useState } from 'react';
import { backupNow } from '../app/backup';
import {
  cloudCount, forgetServer, link, loadConfig, onSyncStatus, setServer, shareLink, signIn, signOut, syncNow, type SyncStatus,
} from '.';
import { SCHEMA_SQL } from './supabase';

const ago = (ts?: number) => {
  if (!ts) return 'zatím nikdy';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'právě teď';
  if (s < 3600) return `před ${Math.round(s / 60)} min`;
  return new Date(ts).toLocaleString('cs-CZ');
};

export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState<SyncStatus>({ state: 'off' });
  useEffect(() => onSyncStatus(setS) as () => void, []);
  return s;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function Guide() {
  const [copied, setCopied] = useState(false);
  return (
    <details className="small">
      <summary>📖 Návod – jak založit cloud (jednou, cca 5 minut)</summary>
      <ol style={{ paddingLeft: 18 }}>
        <li>Na <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a> se zaregistruj (zdarma, třeba přes GitHub) a klikni <b>New project</b>. Název třeba „questy“, region <b>Central EU (Frankfurt)</b>, heslo k databázi si vygeneruj (nebudeš ho potřebovat).</li>
        <li>V projektu otevři <b>SQL Editor</b> → <b>New query</b>, vlož SQL níže a klikni <b>Run</b> (má napsat „Success“).
          <div className="row" style={{ margin: '6px 0' }}>
            <button className="btn-sm" onClick={async () => setCopied(await copy(SCHEMA_SQL))}>{copied ? 'Zkopírováno ✓' : '📋 Zkopírovat SQL'}</button>
          </div>
          <pre style={{ maxHeight: 140, overflow: 'auto', fontSize: 11, whiteSpace: 'pre-wrap' }}>{SCHEMA_SQL}</pre>
        </li>
        <li>Volitelně: <b>Authentication → Sign In / Providers → Email</b> → vypni <b>Confirm email</b> (pak nemusíš potvrzovat e‑mail).</li>
        <li><b>Project Settings → Data API</b> (nebo tlačítko <b>Connect</b>): zkopíruj <b>Project URL</b> (https://….supabase.co).</li>
        <li><b>Project Settings → API Keys</b>: zkopíruj veřejný klíč <b>publishable</b> (sb_publishable_…) nebo <b>anon</b>. Tajný klíč <b>secret / service_role</b> nikdy nepoužívej!</li>
        <li>Obojí vlož sem, ulož, vytvoř si účet (e‑mail + heslo) a zapni synchronizaci.</li>
      </ol>
    </details>
  );
}

/** Nastavení synchronizace mezi zařízeními (Nastavení i úvodní obrazovka). */
export default function SyncPanel({ onboarding = false }: { onboarding?: boolean }) {
  const st = useSyncStatus();
  const cfg = loadConfig();
  const [url, setUrl] = useState(cfg?.url ?? '');
  const [key, setKey] = useState(cfg?.key ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (st.state !== 'unlinked') return;
    setCount(null);
    cloudCount().then(setCount, (e: Error) => setMsg(e.message));
  }, [st.state]);

  const run = async (fn: () => Promise<string | null | void>) => {
    setBusy(true);
    setMsg('');
    try {
      const m = await fn();
      if (m) setMsg(m);
    } finally {
      setBusy(false);
    }
  };

  if (st.state === 'off' || !cfg) {
    return (
      <div className="stack">
        <p className="small muted">
          Propoj telefon, tablet i počítač – všude uvidíš stejné questy, XP i historii. A když se telefon rozbije, o nic nepřijdeš.
          Data jsou v tvém vlastním projektu Supabase (zdarma).
        </p>
        <Guide />
        <div className="field">
          <label>Project URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://abcd1234.supabase.co" autoCapitalize="none" autoCorrect="off" />
        </div>
        <div className="field">
          <label>Veřejný klíč (publishable / anon)</label>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="sb_publishable_…" autoCapitalize="none" autoCorrect="off" />
        </div>
        <button className="primary btn-block" disabled={!url.trim() || !key.trim()}
          onClick={() => {
            if (/service_role|sb_secret_/.test(key)) return setMsg('Tohle je tajný klíč – použij veřejný „publishable“ nebo „anon“.');
            if (!/^https:\/\//.test(url.trim())) return setMsg('Adresa musí začínat https://');
            setServer(url, key);
          }}>Uložit</button>
        {msg && <p className="small" style={{ color: 'var(--red)' }}>{msg}</p>}
      </div>
    );
  }

  if (st.state === 'login') {
    return (
      <div className="stack">
        <p className="small muted">Přihlas se stejným účtem na všech zařízeních. Poprvé si účet vytvoř.</p>
        <div className="field">
          <label>E‑mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" />
        </div>
        <div className="field">
          <label>Heslo</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="grid2">
          <button className="primary" disabled={busy || !email || !password} onClick={() => run(() => signIn(email, password, false))}>Přihlásit</button>
          <button disabled={busy || !email || password.length < 6} onClick={() => run(() => signIn(email, password, true))}>Vytvořit účet</button>
        </div>
        {msg && <p className="small">{msg}</p>}
        <button className="btn-sm" onClick={() => forgetServer()}>Změnit projekt Supabase</button>
      </div>
    );
  }

  if (st.state === 'unlinked') {
    return (
      <div className="stack">
        <p className="small">Přihlášen jako <b>{st.email}</b>.</p>
        {count === null && !msg && <p className="small muted">Zjišťuji, co je v cloudu…</p>}
        {count === 0 && (
          <>
            <p className="small">Cloud je zatím prázdný. Nahraj do něj data z tohoto zařízení – ostatní zařízení si je pak stáhnou.</p>
            <button className="primary btn-block" disabled={busy} onClick={() => run(() => link('upload'))}>⬆ Nahrát a zapnout synchronizaci</button>
          </>
        )}
        {count !== null && count > 0 && (
          <>
            <p className="small">V cloudu už jsou tvoje data ({count} záznamů).</p>
            <button className="primary btn-block" disabled={busy}
              onClick={() => onboarding || confirm('Data v tomto zařízení se nahradí daty z cloudu. Pokračovat?') ? run(() => link('download')) : undefined}>
              ⬇ Stáhnout do tohoto zařízení
            </button>
            {!onboarding && (
              <>
                <p className="small muted">Stažení nahradí data v tomto zařízení. Pokud je tohle zařízení to „hlavní“ a cloud je zastaralý, můžeš naopak cloud přepsat:</p>
                <button className="btn-sm" disabled={busy} onClick={async () => {
                  if (!confirm('Data v cloudu (a tím i na ostatních zařízeních) se nahradí daty z tohoto zařízení. Pokračovat?')) return;
                  await backupNow();
                  run(() => link('upload'));
                }}>⬆ Přepsat cloud tímto zařízením</button>
              </>
            )}
          </>
        )}
        {busy && <p className="small muted">Synchronizuji… (poprvé to může chvíli trvat)</p>}
        {msg && <p className="small" style={{ color: 'var(--red)' }}>{msg}</p>}
        <button className="btn-sm" onClick={() => signOut()}>Odhlásit</button>
      </div>
    );
  }

  const link2 = shareLink();
  return (
    <div className="stack">
      <p className="small">
        {st.state === 'syncing' ? '🔄 Synchronizuji…' : st.state === 'error' ? `⚠️ ${st.error}` : `✅ Synchronizováno ${ago(st.lastSync)}`}
        <br /><span className="muted">Účet: {st.email}</span>
      </p>
      <button className="btn-block" disabled={st.state === 'syncing'} onClick={() => syncNow()}>🔄 Synchronizovat teď</button>
      {link2 && (
        <div>
          <p className="small muted">Na dalším zařízení otevři tenhle odkaz (pošli si ho třeba e‑mailem) – nastavení cloudu se vyplní samo, pak se jen přihlásíš:</p>
          <button className="btn-sm" onClick={async () => {
            const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
            if (nav.share) {
              try { await nav.share({ title: 'Questy života – synchronizace', url: link2 }); return; } catch { /* zrušeno */ }
            }
            setMsg((await copy(link2)) ? 'Odkaz zkopírován ✓' : link2);
          }}>🔗 Poslat odkaz pro další zařízení</button>
        </div>
      )}
      {msg && <p className="small" style={{ wordBreak: 'break-all' }}>{msg}</p>}
      <p className="small muted">Klíče k Trading 212 a Stravě se do cloudu neposílají – na každém zařízení je zadej zvlášť.</p>
      <button className="btn-sm" onClick={() => confirm('Odpojit toto zařízení? Data v něm i v cloudu zůstanou, jen se přestanou synchronizovat.') && signOut()}>Odpojit toto zařízení</button>
    </div>
  );
}

/** Ikonka v horní liště – jen když je synchronizace zapnutá. */
export function SyncBadge() {
  const st = useSyncStatus();
  if (st.state === 'off' || st.state === 'unlinked') return null;
  const icon = st.state === 'syncing' ? '🔄' : st.state === 'idle' ? '☁️' : '⚠️';
  const label = st.state === 'idle' ? `Synchronizováno ${ago(st.lastSync)}` : st.state === 'login' ? 'Synchronizace: přihlas se' : st.error ?? 'Synchronizuji';
  return <a className="btn iconbtn" href="#/settings" aria-label={label} title={label}>{icon}</a>;
}
