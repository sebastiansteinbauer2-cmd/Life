// Python v prohlížeči (Pyodide) – stahuje se z CDN při prvním spuštění úlohy
// a service worker ho pak drží v mezipaměti (funguje i offline).
export const PYODIDE_VERSION = '0.27.7';
export const PYODIDE_BASE = `https://cdn.jsdelivr.net/npm/pyodide@${PYODIDE_VERSION}/`;
