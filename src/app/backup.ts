import { dateKey } from '../lib/date';
import { store } from './context';

/**
 * Záloha jedním klepnutím: na telefonu otevře sdílení (Google Disk, e‑mail, …),
 * jinde soubor stáhne. Vrací false, když uživatel sdílení zrušil.
 */
export async function backupNow(): Promise<boolean> {
  const backup = await store.exportAll();
  const name = `questy-zaloha-${dateKey()}.json`;
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Záloha – Questy života' });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
      download(blob, name);
    }
  } else {
    download(blob, name);
  }
  await store.col('meta').put({ id: 'lastBackup', value: Date.now() });
  return true;
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
