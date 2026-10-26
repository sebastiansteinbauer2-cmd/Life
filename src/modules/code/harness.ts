// Python kód, který spustí řešení na testech. Běží v prohlížeči (Pyodide)
// i v testech aplikace (CPython) – proto je jen jeden.
export const HARNESS = `
import json, sys, io, traceback

def _line(e):
    if isinstance(e, SyntaxError):
        return e.lineno
    for fr in reversed(traceback.extract_tb(e.__traceback__)):
        if fr.filename == "reseni.py":
            return fr.lineno
    return None

def __run(code, fname, tests_json):
    tests = json.loads(tests_json)
    buf = io.StringIO()
    old = sys.stdout
    sys.stdout = buf
    out = []
    try:
        ns = {"__name__": "reseni"}
        try:
            exec(compile(code, "reseni.py", "exec"), ns)
        except BaseException as e:
            return json.dumps({"error": type(e).__name__ + ": " + str(e), "line": _line(e), "stdout": buf.getvalue()[:2000]})
        f = ns.get(fname)
        if not callable(f):
            return json.dumps({"error": "Chybí funkce " + fname + "()", "line": None, "stdout": buf.getvalue()[:2000]})
        for args, exp in tests:
            try:
                got = f(*json.loads(json.dumps(args)))
                try:
                    norm = json.loads(json.dumps(got))
                except (TypeError, ValueError):
                    norm = repr(got)
                ok = norm == exp and isinstance(norm, bool) == isinstance(exp, bool)
                out.append({"ok": ok, "got": repr(got)[:300]})
            except BaseException as e:
                out.append({"ok": False, "error": type(e).__name__ + ": " + str(e), "line": _line(e)})
    finally:
        sys.stdout = old
    return json.dumps({"results": out, "stdout": buf.getvalue()[:2000]})
`;
