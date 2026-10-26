// Kvíz z jazyka C – „Co program vypíše?“ (příprava na PA1 na FIT ČVUT).
// Odpovědi ověřují testy: každý program se přeloží gcc a výstup se porovná.

export interface CQuestion {
  id: string; // 'c:<název>'
  topic: string;
  code: string; // tělo funkce main (hlavičky a main doplní wrapC)
  answer: string;
  explain: string;
  extra?: string; // kód před main (funkce, struktury)
}

export const C_XP = 5;

/** Celý program v C. */
export function wrapC(q: Pick<CQuestion, 'code' | 'extra'>): string {
  const body = q.code.split('\n').map((l) => `    ${l}`).join('\n');
  return `#include <stdio.h>\n#include <string.h>\n${q.extra ? `\n${q.extra}\n` : ''}\nint main(void) {\n${body}\n    return 0;\n}\n`;
}

/** Porovnání odpovědi – nezáleží na mezerách a koncích řádků. */
export const normalizeOut = (s: string) => s.replace(/\s+/g, ' ').trim();
export const isCorrect = (q: CQuestion, answer: string) => normalizeOut(answer) === normalizeOut(q.answer);

export const C_QUESTIONS: CQuestion[] = [
  { id: 'c:intdiv', topic: 'Celočíselné dělení', code: 'int a = 7, b = 2;\nprintf("%d %d\\n", a / b, a % b);', answer: '3 1', explain: 'Dělení dvou intů je celočíselné (zbytek se zahodí), % je zbytek po dělení.' },
  { id: 'c:negdiv', topic: 'Záporné dělení', code: 'printf("%d %d\\n", -7 / 2, -7 % 2);', answer: '-3 -1', explain: 'V C se dělí směrem k nule: −7 / 2 = −3 a zbytek má znaménko dělence: −1.' },
  { id: 'c:incr', topic: 'i++ a ++i', code: 'int i = 5;\nint a = i++;\nint b = ++i;\nprintf("%d %d %d\\n", a, b, i);', answer: '5 7 7', explain: 'i++ vrátí starou hodnotu (5) a pak zvýší na 6; ++i nejdřív zvýší na 7 a vrátí 7.' },
  { id: 'c:double-int', topic: 'Dělení a double', code: 'double x = 7 / 2;\nprintf("%.1f\\n", x);', answer: '3.0', explain: '7 / 2 se spočítá jako int (3) a teprve pak se převede na double.' },
  { id: 'c:double-ok', topic: 'Dělení a double', code: 'double x = 7 / 2.0;\nprintf("%.1f\\n", x);', answer: '3.5', explain: '2.0 je double, takže se dělí v plavoucí čárce.' },
  { id: 'c:char', topic: 'Znaky jsou čísla', code: "char c = 'A' + 2;\nprintf(\"%c %d\\n\", c, c);", answer: 'C 67', explain: "Znak je malé číslo (ASCII). 'A' = 65, + 2 = 67 = 'C'." },
  { id: 'c:case', topic: 'Znaky jsou čísla', code: "printf(\"%d\\n\", 'a' - 'A');", answer: '32', explain: 'Malá a velká písmena se v ASCII liší o 32 (97 − 65).' },
  { id: 'c:for-step', topic: 'Cyklus for', code: 'int s = 0;\nfor (int i = 1; i <= 10; i += 3)\n    s += i;\nprintf("%d\\n", s);', answer: '22', explain: 'i nabývá 1, 4, 7, 10 → 1 + 4 + 7 + 10 = 22.' },
  { id: 'c:for-semicolon', topic: 'Past: středník', code: 'int i;\nfor (i = 0; i < 5; i++);\nprintf("%d\\n", i);', answer: '5', explain: 'Středník za for je prázdné tělo cyklu. Cyklus jen dojede do i = 5 a printf se zavolá jednou.' },
  { id: 'c:dowhile', topic: 'do-while', code: 'int i = 10;\ndo {\n    printf("%d ", i);\n} while (i < 5);\nprintf("\\n");', answer: '10', explain: 'do-while proběhne vždy aspoň jednou – podmínka se testuje až na konci.' },
  { id: 'c:nested', topic: 'Vnořené cykly', code: 'int n = 0;\nfor (int i = 0; i < 4; i++)\n    for (int j = 0; j < i; j++)\n        n++;\nprintf("%d\\n", n);', answer: '6', explain: 'Vnitřní cyklus proběhne 0 + 1 + 2 + 3 = 6krát.' },
  { id: 'c:break', topic: 'break a continue', code: 'for (int i = 0; i < 10; i++) {\n    if (i % 2 == 0) continue;\n    if (i > 6) break;\n    printf("%d ", i);\n}\nprintf("\\n");', answer: '1 3 5', explain: 'Sudá čísla přeskočí continue, u 7 cyklus ukončí break.' },
  { id: 'c:assign-if', topic: 'Past: = místo ==', code: 'int x = 5;\nif (x = 0)\n    printf("A\\n");\nelse\n    printf("B\\n");', answer: 'B', explain: 'x = 0 je přiřazení, jeho hodnota je 0 (nepravda) – a x je teď 0.' },
  { id: 'c:short', topic: 'Zkrácené vyhodnocení', code: 'int x = 0;\nint r = (x == 0) || (++x);\nprintf("%d %d\\n", r, x);', answer: '1 0', explain: 'Levá strana || je pravdivá, pravá se vůbec nevyhodnotí – ++x se neprovede.' },
  { id: 'c:bits', topic: 'Bitové operace', code: 'printf("%d %d %d\\n", 6 & 3, 6 | 3, 6 ^ 3);', answer: '2 7 5', explain: '6 = 110, 3 = 011 → AND 010 = 2, OR 111 = 7, XOR 101 = 5.' },
  { id: 'c:shift', topic: 'Bitové posuny', code: 'printf("%d %d\\n", 1 << 4, 37 >> 2);', answer: '16 9', explain: '1 << 4 = 2⁴ = 16; 37 >> 2 = 37 / 4 = 9 (celočíselně).' },
  { id: 'c:precedence', topic: 'Priorita operátorů', code: 'printf("%d\\n", 10 - 2 * 3 + 8 / 4 % 3);', answer: '6', explain: '*, /, % mají přednost a vyhodnocují se zleva: 2 * 3 = 6, 8 / 4 = 2, 2 % 3 = 2 → 10 − 6 + 2 = 6.' },
  { id: 'c:ternary', topic: 'Ternární operátor', code: 'int a = 5, b = 8;\nprintf("%d\\n", a > b ? a - b : b - a);', answer: '3', explain: 'Podmínka a > b je nepravda, vyhodnotí se b − a = 3.' },
  { id: 'c:uchar', topic: 'Přetečení unsigned', code: 'unsigned char c = 250;\nc += 10;\nprintf("%d\\n", c);', answer: '4', explain: 'unsigned char má rozsah 0–255; 260 přeteče na 260 − 256 = 4.' },
  { id: 'c:array-ptr', topic: 'Pole a ukazatele', code: 'int a[] = {10, 20, 30};\nint *p = a;\np++;\nprintf("%d %d\\n", *p, *(p + 1));', answer: '20 30', explain: 'p ukazuje na a[0]; po p++ na a[1]. *(p + 1) je a[2].' },
  { id: 'c:sizeof-arr', topic: 'sizeof', code: 'int a[10];\nprintf("%d\\n", (int)(sizeof(a) / sizeof(a[0])));', answer: '10', explain: 'sizeof pole je velikost celého pole v bajtech; vydělením velikostí prvku dostaneš počet prvků.' },
  { id: 'c:strlen', topic: 'Řetězce', code: 'char s[] = "ahoj";\nprintf("%d %d\\n", (int)strlen(s), (int)sizeof(s));', answer: '4 5', explain: 'strlen nepočítá ukončovací nulu \\0, sizeof pole ano.' },
  { id: 'c:str-offset', topic: 'Řetězce', code: 'const char *s = "programovani";\nprintf("%s\\n", s + 7);', answer: 'ovani', explain: 's + 7 ukazuje na 8. znak – printf vypíše řetězec od něj do konce.' },
  { id: 'c:str-modify', topic: 'Řetězce', code: 'char s[] = "kocka";\ns[0] = \'m\';\ns[3] = \'\\0\';\nprintf("%s\\n", s);', answer: 'moc', explain: 'Po změně je v poli "moc\\0a" – printf skončí na první nule.' },
  { id: 'c:ptr-write', topic: 'Ukazatele', code: 'int x = 5;\nint *p = &x;\n*p = *p * 3;\nprintf("%d\\n", x);', answer: '15', explain: 'p ukazuje na x, zápis přes *p mění přímo x.' },
  { id: 'c:swap-value', topic: 'Předávání hodnotou', extra: 'void swap(int a, int b) {\n    int t = a;\n    a = b;\n    b = t;\n}', code: 'int x = 1, y = 2;\nswap(x, y);\nprintf("%d %d\\n", x, y);', answer: '1 2', explain: 'Funkce dostane kopie – prohodí jen své lokální proměnné.' },
  { id: 'c:swap-ptr', topic: 'Předávání ukazatelem', extra: 'void swap(int *a, int *b) {\n    int t = *a;\n    *a = *b;\n    *b = t;\n}', code: 'int x = 1, y = 2;\nswap(&x, &y);\nprintf("%d %d\\n", x, y);', answer: '2 1', explain: 'Přes ukazatele funkce mění původní proměnné.' },
  { id: 'c:recursion', topic: 'Rekurze', extra: 'int f(int n) {\n    return n <= 1 ? 1 : n * f(n - 1);\n}', code: 'printf("%d\\n", f(5));', answer: '120', explain: 'f počítá faktoriál: 5 · 4 · 3 · 2 · 1 = 120.' },
  { id: 'c:recursion-print', topic: 'Rekurze', extra: 'void g(int n) {\n    if (n == 0) return;\n    g(n - 1);\n    printf("%d ", n);\n}', code: 'g(3);\nprintf("\\n");', answer: '1 2 3', explain: 'printf je až po rekurzivním volání – vypisuje se při návratu, od nejhlubšího.' },
  { id: 'c:static', topic: 'static proměnná', extra: 'int counter(void) {\n    static int n = 0;\n    return ++n;\n}', code: 'counter();\ncounter();\nprintf("%d\\n", counter());', answer: '3', explain: 'static lokální proměnná si hodnotu pamatuje mezi voláními.' },
  { id: 'c:scope', topic: 'Rozsah platnosti', code: 'int x = 1;\n{\n    int x = 2;\n    printf("%d ", x);\n}\nprintf("%d\\n", x);', answer: '2 1', explain: 'Vnitřní blok má vlastní x, které zakryje vnější – vnější zůstane 1.' },
  { id: 'c:switch', topic: 'switch a break', code: 'int x = 1;\nswitch (x) {\n    case 1: printf("A");\n    case 2: printf("B");\n        break;\n    case 3: printf("C");\n}\nprintf("\\n");', answer: 'AB', explain: 'Bez break vykonávání „propadne“ do dalšího case, až do break.' },
  { id: 'c:2d', topic: 'Dvourozměrné pole', code: 'int m[2][3] = {{1, 2, 3}, {4, 5, 6}};\nprintf("%d\\n", m[1][2] + m[0][1]);', answer: '8', explain: 'm[1][2] je 6 (druhý řádek, třetí sloupec), m[0][1] je 2.' },
  { id: 'c:struct', topic: 'Struktury', extra: 'struct Bod {\n    int x, y;\n};', code: 'struct Bod b = {3, 4};\nstruct Bod c = b;\nc.x = 10;\nprintf("%d %d\\n", b.x, c.x * c.y);', answer: '3 40', explain: 'Přiřazení struktury kopíruje hodnoty – změna c neovlivní b.' },
  { id: 'c:printf-width', topic: 'printf', code: 'printf("[%5d][%-3d][%03d]\\n", 42, 7, 5);', answer: '[   42][7  ][005]', explain: '%5d zarovná doprava na 5 znaků, %-3d doleva na 3, %03d doplní nulami.' },
  { id: 'c:while-sum', topic: 'Cyklus while', code: 'int n = 1234, s = 0;\nwhile (n > 0) {\n    s += n % 10;\n    n /= 10;\n}\nprintf("%d\\n", s);', answer: '10', explain: 'Cyklus sčítá cifry: 4 + 3 + 2 + 1 = 10.' },
];
