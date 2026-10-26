// Programovací úlohy v Pythonu. Každá má testy a vzorové řešení
// (testy v code.test.ts ověřují, že vzorové řešení všemi testy projde).

export type TaskLevel = 'e' | 'm' | 'h';

export interface PyTask {
  id: string; // 'py:<level>-<název>'
  level: TaskLevel;
  title: string;
  fn: string; // jméno funkce, kterou má řešení definovat
  text: string; // zadání
  starter: string;
  tests: [unknown[], unknown][]; // [argumenty, očekávaný výsledek]
  hint: string;
  solution: string;
}

export const LEVEL_LABEL: Record<TaskLevel, string> = { e: 'Lehká', m: 'Střední', h: 'Těžká' };
export const LEVEL_XP: Record<TaskLevel, number> = { e: 15, m: 25, h: 40 };
/** Kolik testů se ukazuje (zbytek je skrytý). */
export const VISIBLE_TESTS = 3;

const t = (o: Omit<PyTask, 'starter'> & { args: string }): PyTask => ({
  ...o,
  starter: `def ${o.fn}(${o.args}):\n    # tvůj kód\n    pass\n`,
});

export const PY_TASKS: PyTask[] = [
  // ---------- lehké ----------
  t({
    id: 'py:e-max3', level: 'e', title: 'Největší ze tří', fn: 'maximum', args: 'a, b, c',
    text: 'Vrať největší ze tří čísel. Nepoužívej funkci max().',
    tests: [[[1, 2, 3], 3], [[3, 2, 1], 3], [[-5, -2, -9], -2], [[4, 4, 1], 4], [[0, 0, 0], 0], [[7, 9, 9], 9]],
    hint: 'Ulož si první číslo jako „zatím největší“ a porovnej ho s ostatními pomocí if.',
    solution: 'def maximum(a, b, c):\n    m = a\n    if b > m:\n        m = b\n    if c > m:\n        m = c\n    return m\n',
  }),
  t({
    id: 'py:e-digits', level: 'e', title: 'Ciferný součet', fn: 'ciferny_soucet', args: 'n',
    text: 'Vrať součet cifer nezáporného celého čísla n. Např. 1234 → 10.',
    tests: [[[1234], 10], [[0], 0], [[9], 9], [[1000], 1], [[99999], 45], [[502], 7]],
    hint: 'n % 10 je poslední cifra, n // 10 ji „usekne“.',
    solution: 'def ciferny_soucet(n):\n    s = 0\n    while n > 0:\n        s += n % 10\n        n //= 10\n    return s\n',
  }),
  t({
    id: 'py:e-even', level: 'e', title: 'Počet sudých', fn: 'pocet_sudych', args: 'cisla',
    text: 'Vrať, kolik čísel v seznamu je sudých.',
    tests: [[[[1, 2, 3, 4]], 2], [[[]], 0], [[[1, 3, 5]], 0], [[[0, -2, 7]], 2], [[[10, 20, 30]], 3]],
    hint: 'Číslo je sudé, když x % 2 == 0.',
    solution: 'def pocet_sudych(cisla):\n    return sum(1 for x in cisla if x % 2 == 0)\n',
  }),
  t({
    id: 'py:e-reverse', level: 'e', title: 'Pozpátku', fn: 'obrat', args: 's',
    text: 'Vrať řetězec s pozpátku. Zkus to cyklem, ne s[::-1].',
    tests: [[['ahoj'], 'joha'], [[''], ''], [['a'], 'a'], [['kajak'], 'kajak'], [['Python 3'], '3 nohtyP']],
    hint: 'Procházej znaky a každý přidávej na začátek výsledku.',
    solution: 'def obrat(s):\n    r = ""\n    for ch in s:\n        r = ch + r\n    return r\n',
  }),
  t({
    id: 'py:e-palindrome', level: 'e', title: 'Palindrom', fn: 'je_palindrom', args: 's',
    text: 'Vrať True, když se s čte stejně zepředu i zezadu. Ignoruj mezery a velikost písmen. „Jelenovi pivo nelej“ je palindrom.',
    tests: [[['kajak'], true], [['Jelenovi pivo nelej'], true], [['ahoj'], false], [[''], true], [['Aa'], true], [['ab ba c'], false]],
    hint: 'Nejdřív z řetězce odstraň mezery a převeď ho na malá písmena (lower, replace).',
    solution: 'def je_palindrom(s):\n    t = s.replace(" ", "").lower()\n    return t == t[::-1]\n',
  }),
  t({
    id: 'py:e-factorial', level: 'e', title: 'Faktoriál', fn: 'faktorial', args: 'n',
    text: 'Vrať n! = 1 · 2 · … · n. Platí 0! = 1.',
    tests: [[[0], 1], [[1], 1], [[5], 120], [[10], 3628800], [[20], 2432902008176640000]],
    hint: 'Začni s výsledkem 1 a v cyklu násob čísly 2 až n.',
    solution: 'def faktorial(n):\n    r = 1\n    for i in range(2, n + 1):\n        r *= i\n    return r\n',
  }),
  t({
    id: 'py:e-fizzbuzz', level: 'e', title: 'FizzBuzz', fn: 'fizzbuzz', args: 'n',
    text: 'Vrať seznam řetězců pro čísla 1 až n: násobky 3 → "Fizz", násobky 5 → "Buzz", násobky 15 → "FizzBuzz", jinak číslo jako text.',
    tests: [[[5], ['1', '2', 'Fizz', '4', 'Buzz']], [[1], ['1']], [[0], []], [[15], ['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz']]],
    hint: 'Podmínku na 15 testuj jako první.',
    solution: 'def fizzbuzz(n):\n    r = []\n    for i in range(1, n + 1):\n        if i % 15 == 0:\n            r.append("FizzBuzz")\n        elif i % 3 == 0:\n            r.append("Fizz")\n        elif i % 5 == 0:\n            r.append("Buzz")\n        else:\n            r.append(str(i))\n    return r\n',
  }),
  t({
    id: 'py:e-vowels', level: 'e', title: 'Samohlásky', fn: 'pocet_samohlasek', args: 's',
    text: 'Vrať počet samohlásek v textu (a, e, i, o, u, y i s diakritikou: á, é, ě, í, ó, ú, ů, ý), bez ohledu na velikost písmen.',
    tests: [[['ahoj'], 2], [['Příliš žluťoučký kůň'], 7], [[''], 0], [['xyz'], 1], [['AEIOU'], 5]],
    hint: 'Připrav si řetězec všech samohlásek a testuj ch in samohlasky.',
    solution: 'def pocet_samohlasek(s):\n    v = "aeiouyáéěíóúůý"\n    return sum(1 for ch in s.lower() if ch in v)\n',
  }),
  t({
    id: 'py:e-avg', level: 'e', title: 'Průměr', fn: 'prumer', args: 'cisla',
    text: 'Vrať průměr čísel zaokrouhlený na 2 desetinná místa (round). Pro prázdný seznam vrať 0.',
    tests: [[[[1, 2, 3, 4]], 2.5], [[[]], 0], [[[5]], 5], [[[1, 2, 2]], 1.67], [[[-1, 1]], 0]],
    hint: 'sum(cisla) / len(cisla) – ale pozor na dělení nulou.',
    solution: 'def prumer(cisla):\n    if not cisla:\n        return 0\n    return round(sum(cisla) / len(cisla), 2)\n',
  }),
  t({
    id: 'py:e-leap', level: 'e', title: 'Přestupný rok', fn: 'prestupny', args: 'rok',
    text: 'Rok je přestupný, když je dělitelný 4, ale ne 100 – kromě roků dělitelných 400. Vrať True/False.',
    tests: [[[2024], true], [[2023], false], [[1900], false], [[2000], true], [[2100], false], [[1600], true]],
    hint: 'rok % 4 == 0 and (rok % 100 != 0 or rok % 400 == 0)',
    solution: 'def prestupny(rok):\n    return rok % 4 == 0 and (rok % 100 != 0 or rok % 400 == 0)\n',
  }),
  t({
    id: 'py:e-minidx', level: 'e', title: 'Index minima', fn: 'index_minima', args: 'cisla',
    text: 'Vrať index nejmenšího čísla v neprázdném seznamu (při shodě první výskyt).',
    tests: [[[[3, 1, 2]], 1], [[[5]], 0], [[[2, 1, 1]], 1], [[[-1, -5, 0, -5]], 1], [[[0, 1, 2]], 0]],
    hint: 'Pamatuj si index dosud nejmenšího prvku a aktualizuj ho jen při ostře menším čísle.',
    solution: 'def index_minima(cisla):\n    best = 0\n    for i in range(1, len(cisla)):\n        if cisla[i] < cisla[best]:\n            best = i\n    return best\n',
  }),
  t({
    id: 'py:e-count', level: 'e', title: 'Počet výskytů', fn: 'pocet_vyskytu', args: 's, znak',
    text: 'Vrať, kolikrát se znak vyskytuje v řetězci s. Nepoužívej s.count().',
    tests: [[['banana', 'a'], 3], [['', 'a'], 0], [['Aaa', 'a'], 2], [['mississippi', 's'], 4], [['abc', 'z'], 0]],
    hint: 'Projdi znaky cyklem for a počítej shody.',
    solution: 'def pocet_vyskytu(s, znak):\n    n = 0\n    for ch in s:\n        if ch == znak:\n            n += 1\n    return n\n',
  }),
  t({
    id: 'py:e-range', level: 'e', title: 'Součet od do', fn: 'soucet_od_do', args: 'a, b',
    text: 'Vrať součet všech celých čísel mezi a a b včetně. Pozor, a může být větší než b.',
    tests: [[[1, 5], 15], [[5, 1], 15], [[3, 3], 3], [[-2, 2], 0], [[1, 100], 5050]],
    hint: 'Nejdřív si zajisti, že a ≤ b (prohoď je).',
    solution: 'def soucet_od_do(a, b):\n    if a > b:\n        a, b = b, a\n    return sum(range(a, b + 1))\n',
  }),
  t({
    id: 'py:e-gcd', level: 'e', title: 'Největší společný dělitel', fn: 'nsd', args: 'a, b',
    text: 'Vrať největšího společného dělitele dvou kladných čísel (Eukleidův algoritmus).',
    tests: [[[12, 18], 6], [[17, 5], 1], [[100, 75], 25], [[7, 7], 7], [[1071, 462], 21]],
    hint: 'Dokud b ≠ 0: a, b = b, a % b. Výsledek je a.',
    solution: 'def nsd(a, b):\n    while b:\n        a, b = b, a % b\n    return a\n',
  }),
  t({
    id: 'py:e-triangle', level: 'e', title: 'Trojúhelník', fn: 'je_trojuhelnik', args: 'a, b, c',
    text: 'Vrať True, když z úseček délek a, b, c jde sestrojit trojúhelník (součet každých dvou je ostře větší než třetí).',
    tests: [[[3, 4, 5], true], [[1, 2, 3], false], [[5, 1, 1], false], [[2, 2, 2], true], [[0, 1, 1], false]],
    hint: 'Musí platit a + b > c, a + c > b a b + c > a.',
    solution: 'def je_trojuhelnik(a, b, c):\n    return a + b > c and a + c > b and b + c > a\n',
  }),

  // ---------- střední ----------
  t({
    id: 'py:m-prime', level: 'm', title: 'Prvočíslo', fn: 'je_prvocislo', args: 'n',
    text: 'Vrať True, když je n prvočíslo. Dělitele stačí zkoušet do √n.',
    tests: [[[2], true], [[1], false], [[0], false], [[17], true], [[21], false], [[97], true], [[7919], true], [[1000001], false]],
    hint: 'Zkoušej d = 2, 3, … dokud d * d <= n.',
    solution: 'def je_prvocislo(n):\n    if n < 2:\n        return False\n    d = 2\n    while d * d <= n:\n        if n % d == 0:\n            return False\n        d += 1\n    return True\n',
  }),
  t({
    id: 'py:m-sieve', level: 'm', title: 'Eratosthenovo síto', fn: 'prvocisla_do', args: 'n',
    text: 'Vrať seznam všech prvočísel ≤ n (Eratosthenovo síto).',
    tests: [[[10], [2, 3, 5, 7]], [[1], []], [[2], [2]], [[30], [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]]],
    hint: 'Seznam True/False délky n+1; pro každé prvočíslo p vyškrtej násobky od p*p.',
    solution: 'def prvocisla_do(n):\n    if n < 2:\n        return []\n    je = [True] * (n + 1)\n    je[0] = je[1] = False\n    p = 2\n    while p * p <= n:\n        if je[p]:\n            for k in range(p * p, n + 1, p):\n                je[k] = False\n        p += 1\n    return [i for i in range(n + 1) if je[i]]\n',
  }),
  t({
    id: 'py:m-fib', level: 'm', title: 'Fibonacci', fn: 'fibonacci', args: 'n',
    text: 'Vrať n-té Fibonacciho číslo (F0 = 0, F1 = 1). Musí to být rychlé i pro n = 70.',
    tests: [[[0], 0], [[1], 1], [[2], 1], [[10], 55], [[50], 12586269025], [[70], 190392490709135]],
    hint: 'Rekurze je pomalá – drž si v cyklu jen poslední dvě hodnoty.',
    solution: 'def fibonacci(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n',
  }),
  t({
    id: 'py:m-binary', level: 'm', title: 'Do dvojkové soustavy', fn: 'do_dvojkove', args: 'n',
    text: 'Vrať zápis nezáporného čísla n ve dvojkové soustavě jako řetězec (bez bin()). 0 → "0".',
    tests: [[[0], '0'], [[1], '1'], [[5], '101'], [[10], '1010'], [[255], '11111111'], [[1024], '10000000000']],
    hint: 'Opakovaně dělej n % 2 (další cifra zprava) a n //= 2.',
    solution: 'def do_dvojkove(n):\n    if n == 0:\n        return "0"\n    r = ""\n    while n > 0:\n        r = str(n % 2) + r\n        n //= 2\n    return r\n',
  }),
  t({
    id: 'py:m-base', level: 'm', title: 'Ze soustavy', fn: 'z_soustavy', args: 's, zaklad',
    text: 'Převeď zápis s v soustavě o základu 2–36 (cifry 0–9, pak A–Z, malá i velká) na číslo. Nepoužívej int(s, zaklad).',
    tests: [[['101', 2], 5], [['FF', 16], 255], [['ff', 16], 255], [['0', 7], 0], [['Z', 36], 35], [['777', 8], 511]],
    hint: 'výsledek = výsledek * základ + hodnota cifry. Hodnotu písmene získáš z ord().',
    solution: 'def z_soustavy(s, zaklad):\n    r = 0\n    for ch in s.upper():\n        v = ord(ch) - 48 if ch.isdigit() else ord(ch) - 55\n        r = r * zaklad + v\n    return r\n',
  }),
  t({
    id: 'py:m-anagram', level: 'm', title: 'Anagramy', fn: 'jsou_anagramy', args: 'a, b',
    text: 'Vrať True, když jsou slova anagramy (stejná písmena v jiném pořadí). Ignoruj mezery a velikost písmen.',
    tests: [[['listen', 'silent'], true], [['Kokos', 'skoko'], true], [['abc', 'abd'], false], [['aab', 'abb'], false], [['a b', 'ba'], true]],
    hint: 'Porovnej seřazené znaky obou řetězců (sorted).',
    solution: 'def jsou_anagramy(a, b):\n    f = lambda s: sorted(s.replace(" ", "").lower())\n    return f(a) == f(b)\n',
  }),
  t({
    id: 'py:m-word', level: 'm', title: 'Nejčastější slovo', fn: 'nejcastejsi_slovo', args: 'text',
    text: 'Vrať nejčastější slovo v textu (malými písmeny, slova odděluje mezera). Při shodě vrať abecedně první.',
    tests: [[['a b a'], 'a'], [['Pes kocka pes'], 'pes'], [['b a'], 'a'], [['x'], 'x'], [['jedna dva dva tri tri'], 'dva']],
    hint: 'Spočítej výskyty do slovníku, pak vyber maximum s ohledem na shodu.',
    solution: 'def nejcastejsi_slovo(text):\n    c = {}\n    for w in text.lower().split():\n        c[w] = c.get(w, 0) + 1\n    return min(c, key=lambda w: (-c[w], w))\n',
  }),
  t({
    id: 'py:m-rle', level: 'm', title: 'Komprese RLE', fn: 'rle', args: 's',
    text: 'Zkomprimuj řetězec: každý úsek stejných znaků nahraď znakem a délkou. "aaabcc" → "a3b1c2".',
    tests: [[['aaabcc'], 'a3b1c2'], [[''], ''], [['a'], 'a1'], [['abab'], 'a1b1a1b1'], [['zzzzzzzzzzzz'], 'z12']],
    hint: 'Procházej znaky a počítej, dokud se znak nezmění.',
    solution: 'def rle(s):\n    r = ""\n    i = 0\n    while i < len(s):\n        j = i\n        while j < len(s) and s[j] == s[i]:\n            j += 1\n        r += s[i] + str(j - i)\n        i = j\n    return r\n',
  }),
  t({
    id: 'py:m-second', level: 'm', title: 'Druhé největší', fn: 'druhe_nejvetsi', args: 'cisla',
    text: 'Vrať druhou největší různou hodnotu v seznamu. Když neexistuje, vrať None.',
    tests: [[[[1, 5, 3]], 3], [[[5, 5, 4]], 4], [[[7]], null], [[[2, 2]], null], [[[-1, -3, -2]], -2]],
    hint: 'Udržuj si dvě proměnné: největší a druhou největší (různou).',
    solution: 'def druhe_nejvetsi(cisla):\n    u = sorted(set(cisla))\n    return u[-2] if len(u) >= 2 else None\n',
  }),
  t({
    id: 'py:m-transpose', level: 'm', title: 'Transpozice matice', fn: 'transpozice', args: 'm',
    text: 'Vrať transponovanou matici (řádky se stanou sloupci). Matice je seznam řádků.',
    tests: [[[[[1, 2, 3], [4, 5, 6]]], [[1, 4], [2, 5], [3, 6]]], [[[[1]]], [[1]]], [[[[1, 2]]], [[1], [2]]], [[[[1, 2], [3, 4]]], [[1, 3], [2, 4]]]],
    hint: 'Prvek m[i][j] patří na pozici [j][i].',
    solution: 'def transpozice(m):\n    return [[m[i][j] for i in range(len(m))] for j in range(len(m[0]))]\n',
  }),
  t({
    id: 'py:m-sort', level: 'm', title: 'Řazení', fn: 'serad', args: 'cisla',
    text: 'Vrať nový seřazený seznam (vzestupně). Napiš vlastní řazení – bubble sort nebo insertion sort, ne sorted().',
    tests: [[[[3, 1, 2]], [1, 2, 3]], [[[]], []], [[[5, -1, 5, 0]], [-1, 0, 5, 5]], [[[1, 2, 3]], [1, 2, 3]], [[[9, 8, 7, 6, 5]], [5, 6, 7, 8, 9]]],
    hint: 'Bubble sort: opakovaně prohazuj sousedy, které jsou ve špatném pořadí.',
    solution: 'def serad(cisla):\n    a = list(cisla)\n    for i in range(len(a)):\n        for j in range(len(a) - 1 - i):\n            if a[j] > a[j + 1]:\n                a[j], a[j + 1] = a[j + 1], a[j]\n    return a\n',
  }),
  t({
    id: 'py:m-merge', level: 'm', title: 'Slití seznamů', fn: 'slij', args: 'a, b',
    text: 'Dostaneš dva seřazené seznamy. Vrať jeden seřazený seznam ze všech prvků – v lineárním čase (jako v merge sortu).',
    tests: [[[[1, 3, 5], [2, 4]], [1, 2, 3, 4, 5]], [[[], [1]], [1]], [[[], []], []], [[[1, 1], [1]], [1, 1, 1]], [[[5], [1, 2, 3]], [1, 2, 3, 5]]],
    hint: 'Dva ukazatele i, j – vždy vezmi menší z a[i], b[j].',
    solution: 'def slij(a, b):\n    i = j = 0\n    r = []\n    while i < len(a) and j < len(b):\n        if a[i] <= b[j]:\n            r.append(a[i])\n            i += 1\n        else:\n            r.append(b[j])\n            j += 1\n    return r + a[i:] + b[j:]\n',
  }),
  t({
    id: 'py:m-bsearch', level: 'm', title: 'Binární vyhledávání', fn: 'binarni_hledani', args: 'cisla, x',
    text: 'V seřazeném seznamu různých čísel najdi x binárním vyhledáváním. Vrať jeho index, nebo -1.',
    tests: [[[[1, 3, 5, 7, 9], 7], 3], [[[1, 3, 5], 4], -1], [[[], 1], -1], [[[2], 2], 0], [[[1, 2, 3, 4, 5, 6], 1], 0], [[[1, 2, 3, 4, 5, 6], 6], 5]],
    hint: 'Hranice lo, hi; podívej se doprostřed a zahoď polovinu, kde x být nemůže.',
    solution: 'def binarni_hledani(cisla, x):\n    lo, hi = 0, len(cisla) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if cisla[mid] == x:\n            return mid\n        if cisla[mid] < x:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n',
  }),
  t({
    id: 'py:m-caesar', level: 'm', title: 'Caesarova šifra', fn: 'caesar', args: 'text, posun',
    text: 'Posuň každé písmeno anglické abecedy o posun (cyklicky, zachovej velikost). Ostatní znaky nech být. Posun může být i záporný.',
    tests: [[['abc', 1], 'bcd'], [['xyz', 3], 'abc'], [['Ahoj, svete!', 13], 'Nubw, firgr!'], [['bcd', -1], 'abc'], [['ABC', 26], 'ABC']],
    hint: 'chr((ord(ch) - ord("a") + posun) % 26 + ord("a"))',
    solution: 'def caesar(text, posun):\n    r = ""\n    for ch in text:\n        if "a" <= ch <= "z":\n            r += chr((ord(ch) - 97 + posun) % 26 + 97)\n        elif "A" <= ch <= "Z":\n            r += chr((ord(ch) - 65 + posun) % 26 + 65)\n        else:\n            r += ch\n    return r\n',
  }),
  t({
    id: 'py:m-perfect', level: 'm', title: 'Dokonalá čísla', fn: 'dokonala_do', args: 'n',
    text: 'Vrať seznam dokonalých čísel ≤ n (číslo je rovno součtu svých dělitelů menších než ono, např. 6 = 1 + 2 + 3).',
    tests: [[[10], [6]], [[5], []], [[30], [6, 28]], [[10000], [6, 28, 496, 8128]]],
    hint: 'Pro každé číslo sečti dělitele – stačí do √k a přičítat dvojice d a k // d.',
    solution: 'def dokonala_do(n):\n    r = []\n    for k in range(2, n + 1):\n        s = 1\n        d = 2\n        while d * d <= k:\n            if k % d == 0:\n                s += d\n                if d != k // d:\n                    s += k // d\n            d += 1\n        if s == k:\n            r.append(k)\n    return r\n',
  }),
  t({
    id: 'py:m-collatz', level: 'm', title: 'Collatzova posloupnost', fn: 'collatz_kroky', args: 'n',
    text: 'Dokud n ≠ 1: sudé n vyděl 2, liché nahraď 3n + 1. Vrať počet kroků do 1.',
    tests: [[[1], 0], [[2], 1], [[6], 8], [[7], 16], [[27], 111]],
    hint: 'Obyčejný while cyklus s počítadlem.',
    solution: 'def collatz_kroky(n):\n    k = 0\n    while n != 1:\n        n = n // 2 if n % 2 == 0 else 3 * n + 1\n        k += 1\n    return k\n',
  }),
  t({
    id: 'py:m-roman', level: 'm', title: 'Římská čísla', fn: 'rimske', args: 'n',
    text: 'Převeď číslo 1–3999 na římské číslo (I, V, X, L, C, D, M; 4 = IV, 9 = IX, 40 = XL…).',
    tests: [[[1], 'I'], [[4], 'IV'], [[9], 'IX'], [[14], 'XIV'], [[1994], 'MCMXCIV'], [[2026], 'MMXXVI'], [[3999], 'MMMCMXCIX']],
    hint: 'Tabulka hodnot včetně 900, 400, 90, 40, 9, 4 – odečítej od největší.',
    solution: 'def rimske(n):\n    t = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"), (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]\n    r = ""\n    for v, z in t:\n        while n >= v:\n            r += z\n            n -= v\n    return r\n',
  }),

  // ---------- těžké ----------
  t({
    id: 'py:h-brackets', level: 'h', title: 'Uzávorkování', fn: 'uzavorkovani_ok', args: 's',
    text: 'Vrať True, když jsou závorky ( ) [ ] { } v řetězci správně spárované a vnořené. Ostatní znaky ignoruj.',
    tests: [[['()[]{}'], true], [['([{}])'], true], [['(]'], false], [['(('], false], [[''], true], [['a(b[c]d)e'], true], [['([)]'], false], [['}{'], false]],
    hint: 'Zásobník: otevírací závorku ulož, u zavírací zkontroluj vrchol zásobníku.',
    solution: 'def uzavorkovani_ok(s):\n    par = {")": "(", "]": "[", "}": "{"}\n    st = []\n    for ch in s:\n        if ch in "([{":\n            st.append(ch)\n        elif ch in par:\n            if not st or st.pop() != par[ch]:\n                return False\n    return not st\n',
  }),
  t({
    id: 'py:h-lis', level: 'h', title: 'Nejdelší rostoucí podposloupnost', fn: 'nejdelsi_rostouci', args: 'cisla',
    text: 'Vrať délku nejdelší ostře rostoucí podposloupnosti (prvky nemusí jít za sebou). [10, 9, 2, 5, 3, 7, 101, 18] → 4.',
    tests: [[[[10, 9, 2, 5, 3, 7, 101, 18]], 4], [[[]], 0], [[[5]], 1], [[[3, 2, 1]], 1], [[[1, 2, 2, 3]], 3], [[[0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15]], 6]],
    hint: 'Dynamické programování: d[i] = nejdelší podposloupnost končící na i.',
    solution: 'def nejdelsi_rostouci(cisla):\n    d = [1] * len(cisla)\n    for i in range(len(cisla)):\n        for j in range(i):\n            if cisla[j] < cisla[i]:\n                d[i] = max(d[i], d[j] + 1)\n    return max(d, default=0)\n',
  }),
  t({
    id: 'py:h-coins', level: 'h', title: 'Nejméně mincí', fn: 'pocet_minci', args: 'castka, mince',
    text: 'Vrať nejmenší počet mincí, kterými jde zaplatit částka (každé mince je neomezeně). Když to nejde, vrať -1. Pozor: hladový postup nefunguje vždy!',
    tests: [[[11, [1, 2, 5]], 3], [[3, [2]], -1], [[0, [1]], 0], [[6, [1, 3, 4]], 2], [[100, [1, 5, 10, 20, 50]], 2], [[7, [2, 4]], -1]],
    hint: 'd[x] = 1 + min(d[x − m]) přes všechny mince m.',
    solution: 'def pocet_minci(castka, mince):\n    INF = float("inf")\n    d = [0] + [INF] * castka\n    for x in range(1, castka + 1):\n        for m in mince:\n            if m <= x and d[x - m] + 1 < d[x]:\n                d[x] = d[x - m] + 1\n    return d[castka] if d[castka] != INF else -1\n',
  }),
  t({
    id: 'py:h-subset', level: 'h', title: 'Součet podmnožiny', fn: 'existuje_soucet', args: 'cisla, cil',
    text: 'Vrať True, když jde vybrat některá z kladných čísel (každé nejvýš jednou) tak, aby jejich součet byl přesně cil.',
    tests: [[[[3, 34, 4, 12, 5, 2], 9], true], [[[3, 34, 4, 12, 5, 2], 30], false], [[[], 0], true], [[[1], 2], false], [[[2, 2, 2], 6], true]],
    hint: 'Množina dosažitelných součtů: pro každé číslo přidej k existujícím součtům.',
    solution: 'def existuje_soucet(cisla, cil):\n    s = {0}\n    for x in cisla:\n        s |= {a + x for a in s if a + x <= cil}\n    return cil in s\n',
  }),
  t({
    id: 'py:h-islands', level: 'h', title: 'Počet ostrovů', fn: 'pocet_ostrovu', args: 'mapa',
    text: 'Mapa je seznam řetězců, „#“ je pevnina, „.“ voda. Vrať počet ostrovů (pevnina spojená nahoru/dolů/doleva/doprava).',
    tests: [[[['#..', '.#.', '..#']], 3], [[['##', '##']], 1], [[['...']], 0], [[['#.#', '###', '#.#']], 1], [[['#.#.#']], 3]],
    hint: 'Projdi mřížku; na každé nenavštívené pevnině spusť prohledávání (DFS/BFS) a označ celý ostrov.',
    solution: 'def pocet_ostrovu(mapa):\n    h, w = len(mapa), len(mapa[0]) if mapa else 0\n    seen = set()\n    n = 0\n    for r in range(h):\n        for c in range(w):\n            if mapa[r][c] == "#" and (r, c) not in seen:\n                n += 1\n                st = [(r, c)]\n                seen.add((r, c))\n                while st:\n                    y, x = st.pop()\n                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):\n                        ny, nx = y + dy, x + dx\n                        if 0 <= ny < h and 0 <= nx < w and mapa[ny][nx] == "#" and (ny, nx) not in seen:\n                            seen.add((ny, nx))\n                            st.append((ny, nx))\n    return n\n',
  }),
  t({
    id: 'py:h-perm', level: 'h', title: 'Permutace', fn: 'permutace', args: 's',
    text: 'Vrať abecedně seřazený seznam všech různých permutací řetězce s (bez itertools).',
    tests: [[['ab'], ['ab', 'ba']], [['abc'], ['abc', 'acb', 'bac', 'bca', 'cab', 'cba']], [['aab'], ['aab', 'aba', 'baa']], [['a'], ['a']], [[''], ['']]],
    hint: 'Rekurze: vyber první znak a připoj permutace zbytku. Duplicity odstraní množina.',
    solution: 'def permutace(s):\n    if len(s) <= 1:\n        return [s]\n    r = set()\n    for i, ch in enumerate(s):\n        for p in permutace(s[:i] + s[i + 1:]):\n            r.add(ch + p)\n    return sorted(r)\n',
  }),
  t({
    id: 'py:h-maze', level: 'h', title: 'Nejkratší cesta bludištěm', fn: 'nejkratsi_cesta', args: 'mapa',
    text: 'Bludiště je seznam řetězců: „S“ start, „C“ cíl, „#“ zeď, „.“ cesta. Vrať nejmenší počet kroků (nahoru/dolů/doleva/doprava) ze S do C, nebo -1.',
    tests: [[[['S.C']], 2], [[['S#C']], -1], [[['S..', '##.', 'C..']], 6], [[['S', '.', 'C']], 2], [[['S.#', '##C', '...']], -1], [[['S...', '.##.', '...C']], 5]],
    hint: 'Prohledávání do šířky (BFS) z fronty – první dosažení cíle je nejkratší.',
    solution: 'def nejkratsi_cesta(mapa):\n    from collections import deque\n    h, w = len(mapa), len(mapa[0])\n    for r in range(h):\n        for c in range(w):\n            if mapa[r][c] == "S":\n                start = (r, c)\n    q = deque([(start, 0)])\n    seen = {start}\n    while q:\n        (y, x), d = q.popleft()\n        if mapa[y][x] == "C":\n            return d\n        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):\n            ny, nx = y + dy, x + dx\n            if 0 <= ny < h and 0 <= nx < w and mapa[ny][nx] != "#" and (ny, nx) not in seen:\n                seen.add((ny, nx))\n                q.append(((ny, nx), d + 1))\n    return -1\n',
  }),
  t({
    id: 'py:h-kadane', level: 'h', title: 'Největší souvislý součet', fn: 'max_podsoucet', args: 'cisla',
    text: 'Vrať největší součet souvislého (neprázdného) úseku seznamu. [-2, 1, -3, 4, -1, 2, 1, -5, 4] → 6. Zvládneš to v lineárním čase?',
    tests: [[[[-2, 1, -3, 4, -1, 2, 1, -5, 4]], 6], [[[1]], 1], [[[-3, -1, -2]], -1], [[[5, 4, -1, 7, 8]], 23], [[[0, 0]], 0]],
    hint: 'Kadaneův algoritmus: nejlepší součet končící na i je max(x, předchozí + x).',
    solution: 'def max_podsoucet(cisla):\n    best = cur = cisla[0]\n    for x in cisla[1:]:\n        cur = max(x, cur + x)\n        best = max(best, cur)\n    return best\n',
  }),
  t({
    id: 'py:h-queens', level: 'h', title: 'Problém n dam', fn: 'pocet_dam', args: 'n',
    text: 'Kolika způsoby lze na šachovnici n × n rozestavit n dam tak, aby se žádné dvě neohrožovaly? (Pro n = 8 je to 92.)',
    tests: [[[1], 1], [[2], 0], [[3], 0], [[4], 2], [[6], 4], [[8], 92]],
    hint: 'Backtracking po řádcích; hlídej obsazené sloupce a obě diagonály (r − c a r + c).',
    solution: 'def pocet_dam(n):\n    cols, d1, d2 = set(), set(), set()\n    def go(r):\n        if r == n:\n            return 1\n        k = 0\n        for c in range(n):\n            if c in cols or r - c in d1 or r + c in d2:\n                continue\n            cols.add(c); d1.add(r - c); d2.add(r + c)\n            k += go(r + 1)\n            cols.remove(c); d1.remove(r - c); d2.remove(r + c)\n        return k\n    return go(0)\n',
  }),
  t({
    id: 'py:h-eval', level: 'h', title: 'Kalkulačka', fn: 'vyhodnot', args: 'vyraz',
    text: 'Vyhodnoť výraz s celými čísly, operátory + − * a závorkami, s mezerami i bez. Respektuj přednost násobení. Nepoužívej eval().',
    tests: [[['1 + 2 * 3'], 7], [['(1 + 2) * 3'], 9], [['10 - 4 - 3'], 3], [['2*(3+4)*5'], 70], [['42'], 42], [['2 * (3 - 10)'], -14]],
    hint: 'Rekurzivní sestup: výraz = člen (± člen)*, člen = faktor (* faktor)*, faktor = číslo | ( výraz ).',
    solution: 'def vyhodnot(vyraz):\n    s = vyraz.replace(" ", "")\n    i = 0\n    def expr():\n        nonlocal i\n        v = term()\n        while i < len(s) and s[i] in "+-":\n            op = s[i]\n            i += 1\n            t = term()\n            v = v + t if op == "+" else v - t\n        return v\n    def term():\n        nonlocal i\n        v = factor()\n        while i < len(s) and s[i] == "*":\n            i += 1\n            v *= factor()\n        return v\n    def factor():\n        nonlocal i\n        if s[i] == "(":\n            i += 1\n            v = expr()\n            i += 1\n            return v\n        j = i\n        while i < len(s) and s[i].isdigit():\n            i += 1\n        return int(s[j:i])\n    return expr()\n',
  }),
  t({
    id: 'py:h-lcs', level: 'h', title: 'Nejdelší společná podposloupnost', fn: 'nejdelsi_spolecna', args: 'a, b',
    text: 'Vrať délku nejdelší společné podposloupnosti dvou řetězců (znaky nemusí jít za sebou). "ABCBDAB" a "BDCABA" → 4.',
    tests: [[['ABCBDAB', 'BDCABA'], 4], [['', 'abc'], 0], [['abc', 'abc'], 3], [['abc', 'def'], 0], [['programovani', 'algoritmus'], 3]],
    hint: 'Tabulka d[i][j] pro prefixy: shoda → d[i−1][j−1] + 1, jinak max(d[i−1][j], d[i][j−1]).',
    solution: 'def nejdelsi_spolecna(a, b):\n    d = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]\n    for i in range(1, len(a) + 1):\n        for j in range(1, len(b) + 1):\n            if a[i - 1] == b[j - 1]:\n                d[i][j] = d[i - 1][j - 1] + 1\n            else:\n                d[i][j] = max(d[i - 1][j], d[i][j - 1])\n    return d[len(a)][len(b)]\n',
  }),
];

export const taskById = (id: string) => PY_TASKS.find((x) => x.id === id);
