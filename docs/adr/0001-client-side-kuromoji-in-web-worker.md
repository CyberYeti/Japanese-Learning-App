# Client-side Kuromoji in Dedicated Web Worker with Cache API

We run Kuromoji and its IPADIC dictionary entirely inside a client-side Web Worker, caching the gzipped dictionary files via the browser Cache API.

## Context
Kuromoji requires ~12–17 MB of binary dictionary files and takes 1–3 seconds to build search indices. To maintain a $0 hosting cost on GitHub Pages without a backend server, all tokenization, reading alignment, and coverage checking must run on the client. 

## Decision
We execute Kuromoji inside a dedicated Web Worker initialized eagerly on root layout mount. Dictionary files are fetched from static assets and stored in Cache Storage. Main UI threads communicate asynchronously with the worker for tokenization, furigana, and grammar matching.

## Consequences
- Zero backend server infrastructure or recurring hosting costs.
- Tokenization never blocks UI rendering or touch events on mobile devices.
- Offline and low-connectivity tokenization works once the dictionary cache is primed.
