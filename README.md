# ⚔ Questy života

Osobní gamifikovaný systém seberozvoje ve stylu RPG. Učení, trénink, šachy i objevy jsou **questy** – za každý dostáváš XP, levelíš a zlepšuješ statistiky postavy (Inteligence, Síla, Disciplína, Šachy).

- **Jádro hry** – level (na další level je potřeba 100 × level XP), tituly Nováček → Učeň → Tovaryš → Bojovník → Veterán → Mistr → Velmistr → Legenda, denní / týdenní / jednorázové a vlastní questy, streaky s bonusy za 7 / 30 / 100 dní, odznaky, toasty a efekt LEVEL UP (respektuje *prefers-reduced-motion*).
- **∑ Matematika** – generátor příkladů z 10 témat (maturita CERMAT + přijímačky FIT ČVUT) ve 3 úrovních, kontrola odpovědí (zlomky, √, π, kořeny v libovolném pořadí, intervaly, komplexní čísla, výrazy, rovnice přímek), řešení krok za krokem, opakování slabých témat s rozestupy, boss fight (simulace přijímaček 0–100 b., hranice 70) a grafy.
- **🏋️ Trénink** – týdenní plán (horní / dolní / core / volno), automatická progrese podle cíle, osobní rekordy s bonusovým XP, level každého cviku, vlastní cviky, váha a grafy.
- **♞ Šachy** – synchronizace s Chess.com (XP za nové partie, víc za rapid, bonus za výhru a rekordní rating), graf ratingu, statistika podle barvy a zahájení, poznámky a rozbory partií, týdenní plán a knihy jako dlouhodobé questy.
- **🔭 Objevy** – Video dne a seznam nejnovějších videí z YouTube kanálů v knihovně (přehrávání přímo v aplikaci, po zhlédnutí zápis objevu), Objev dne, deník znalostí se štítky a vyhledáváním, knihovna zdrojů, náhodný článek z Wikipedie a týdenní opakovací kvíz.
- **🏊 Ironman** – napojení na Stravu: plavání, kolo a běh se načítají samy, XP do nové statistiky Vytrvalost, týdenní questy (2× plavání, 2× kolo, 3× běh, brick), připravenost na Ironman / 70.3, hodiny po týdnech, osobní rekordy, odpočet do závodu a odznaky.
- **💰 Finance** – napojení na Trading 212 (API klíč jen pro čtení): hodnota účtu, zisk/ztráta, pozice, graf portfolia, vklady a dividendy. Měsíční quest „investuj svůj cíl“, série měsíců v řadě (bonus za 3 / 6 / 12), XP za vklady, dividendy a milníky portfolia, odznaky.

Data jsou uložená **jen ve tvém zařízení** (IndexedDB). V **Nastavení → Export** si pravidelně stahuj zálohu (JSON).

---

## Struktura projektu

```
src/
  data/            datová vrstva: typy, rozhraní DataStore, Dexie (IndexedDB) a paměťová implementace
  game/            herní jádro: XP a levely, questy, streaky, odznaky, engine (+ testy)
  app/             globální stav (store, hooky), router, výchozí data
  components/      UI prvky: XP lišta, toasty, questy, grafy (Chart.js), KaTeX
  pages/           Domů, Onboarding, Nastavení, Odznaky
  modules/
    math/          generátor příkladů (gen/*), parser odpovědí, opakování, stránky (+ testy)
    training/      plán, progrese, stránky (+ testy)
    chess/         Chess.com API, synchronizace, stránky (+ testy)
    discover/      objevy, deník, knihovna, kvíz (+ testy)
api/chess.js       volitelná proxy pro Chess.com (Vercel Function)
public/            ikony aplikace
```

**Výměna úložiště za cloud (např. Supabase):** celá aplikace pracuje jen s abstraktní třídou `DataStore` (`src/data/store.ts`). Stačí napsat třeba `SupabaseStore`, který implementuje metodu `col(name)` (operace `all / get / put / bulkPut / delete / clear` nad tabulkou), a v `src/app/context.tsx` vyměnit `new DexieStore()` za novou třídu. Názvy kolekcí a typy záznamů jsou v `src/data/types.ts`.

**Trading 212 a CORS:** API klíč se ukládá jen v telefonu (localStorage) – není v exportované záloze. Aplikace nejdřív zkusí API volat přímo; pokud to prohlížeč zablokuje (CORS), použije proxy `api/t212.js`. Tu získáš nasazením projektu na Vercel (viz níže) a do modulu Finance → *Nastavení propojení* zadáš `https://<tvoje-app>.vercel.app/api/t212`. Aplikace samotná může dál běžet na GitHub Pages.

**Strava:** přihlášení řeší funkce `api/strava.js` na Vercelu. Jednorázově: na strava.com/settings/api vytvoř aplikaci (Authorization Callback Domain = adresa tvého Vercel projektu), pak ve Vercelu → Settings → Environment Variables přidej `STRAVA_CLIENT_ID` a `STRAVA_CLIENT_SECRET` a dej Redeploy. Návod je přímo v aplikaci v sekci Ironman.

**YouTube videa:** seznam nejnovějších videí stahuje funkce `api/yt.js` na tvém Vercel serveru (z RSS kanálu, bez API klíče). Adresa serveru se bere z Nastavení → *Server (Vercel)*, případně z proxy u Financí. Kanál přidáš v Objevy → Knihovna odkazem ve tvaru `https://www.youtube.com/@kanal`.

**Chess.com a CORS:** veřejné API Chess.com posílá hlavičku `Access-Control-Allow-Origin: *`, takže aplikace ho volá přímo z prohlížeče. Kdyby to někdy přestalo fungovat, nasaď aplikaci na Vercel a do Nastavení → *Proxy URL* zadej `https://<tvoje-app>.vercel.app/api/chess`.

---

## Návod pro začátečníky

### 1. Spuštění na počítači

1. Nainstaluj **Node.js** (verze 20 nebo novější) z <https://nodejs.org> – stačí verze „LTS“.
2. Stáhni si projekt (na GitHubu tlačítko **Code → Download ZIP**, nebo `git clone`).
3. Otevři složku projektu v terminálu (ve Windows: ve složce klikni do adresního řádku, napiš `cmd` a Enter).
4. Nainstaluj závislosti (jen poprvé):
   ```
   npm install
   ```
5. Spusť vývojový server:
   ```
   npm run dev
   ```
6. Otevři v prohlížeči adresu, kterou terminál vypíše (obvykle <http://localhost:5173>).

Další užitečné příkazy:

| Příkaz | Co dělá |
| --- | --- |
| `npm test` | spustí testy (mimo jiné ověří stovky vygenerovaných příkladů) |
| `npm run build` | vytvoří produkční verzi do složky `dist/` |
| `npm run preview` | spustí produkční verzi lokálně (tady funguje i offline režim) |

### 2. Nasazení na internet – varianta A: GitHub Pages (zdarma, nejjednodušší)

Projekt už obsahuje automatické nasazení (`.github/workflows/deploy.yml`).

1. Nahraj kód do svého repozitáře na GitHubu do větve **main** (pokud je kód v jiné větvi, sluč ji přes Pull Request do `main`).
2. Na GitHubu otevři repozitář → **Settings** → **Pages**.
3. V části **Build and deployment → Source** vyber **GitHub Actions**.
4. Otevři záložku **Actions** – běží workflow „Nasazení na GitHub Pages“. Po 1–2 minutách se objeví zelená fajfka ✅.
5. Aplikace poběží na adrese `https://<tvoje-jmeno>.github.io/<nazev-repozitare>/` (adresu najdeš i v Settings → Pages).

Každý další push do `main` aplikaci automaticky aktualizuje. (Pozn.: u soukromého repozitáře vyžaduje GitHub Pages placený účet – jinak repozitář přepni na veřejný nebo použij Vercel.)

### 3. Nasazení na internet – varianta B: Vercel (zdarma, i se šachovou proxy)

1. Zaregistruj se na <https://vercel.com> přes svůj GitHub účet.
2. Klikni **Add New… → Project** a vyber repozitář s aplikací → **Import**.
3. Vercel sám pozná Vite (Build Command `npm run build`, Output Directory `dist`). Klikni **Deploy**.
4. Za chvíli dostaneš adresu typu `https://questy-zivota.vercel.app`.
5. Na Vercelu automaticky funguje i proxy `…/api/chess` (stačí ji zadat v Nastavení aplikace, pokud by přímé spojení s Chess.com nefungovalo).

### 4. Instalace na mobil (Android)

1. Otevři adresu aplikace v **Chrome** na telefonu.
2. Klepni na **⋮** (vpravo nahoře) → **Přidat na plochu** / **Nainstalovat aplikaci** → **Instalovat**.
3. Na ploše se objeví ikona s mečem ⚔. Aplikace se otevírá přes celou obrazovku jako normální aplikace a **funguje i offline**.
4. Při prvním spuštění projdeš onboardingem (jméno, maxima cviků, Chess.com, úroveň matematiky).

Na iPhonu: otevři adresu v Safari → **Sdílet** → **Přidat na plochu**.

> ⚠️ Data jsou v prohlížeči daného zařízení. Když vymažeš data prohlížeče nebo aplikaci odinstaluješ, přijdeš o ně – proto si občas udělej **Export zálohy** (Nastavení) a ulož si soubor třeba na Google Disk. Zálohu jde nahrát i do jiného zařízení přes **Import**.

---

## Jak se počítá XP

| Akce | XP | Statistika |
| --- | --- | --- |
| Quest: Snadný / Střední / Těžký / Epický | 10 / 25 / 50 / 100 | podle questu |
| Správně vyřešený příklad (základ / rozšiřující / FIT) | 3 / 4 / 5 | Inteligence |
| Boss fight | polovina bodů + 50 za ≥ 70 bodů | Inteligence |
| Trénink | objem / 4 (5–120) | Síla |
| Osobní rekord | +20 | Síla |
| Partie rapid / daily / blitz / bullet (výhra +50 %) | 15 / 10 / 6 / 3 | Šachy |
| Rekordní rapid rating / rozbor partie | +30 / +20 | Šachy |
| Kapitola knihy / dočtená kniha | +30 / +150 | Šachy |
| Další objev v jednom dni | +5 | Inteligence |
| Série 7 / 30 / 100 dní (celková; modulová poloviční) | 50 / 200 / 500 | Disciplína |
| Vklad na Trading 212 (podle měsíčního cíle) | 10–100 | Disciplína |
| Dividenda / nový milník portfolia | +5 / +100 | Disciplína |
| Měsíční cíl splněn / série 3 / 6 / 12 měsíců | 100 / 100 / 250 / 500 | Disciplína |
