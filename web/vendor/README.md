# Vendored third-party code

## pdf.js

`pdf.min.mjs` and `pdf.worker.min.mjs` are the prebuilt distribution of
[pdf.js](https://github.com/mozilla/pdf.js) version **4.10.38**, by Mozilla,
licensed under the Apache License 2.0 — the full text is in `LICENSE-pdfjs`.

They are committed rather than fetched from a CDN on purpose. The page promises
that a floor plan never leaves the machine it was opened on, and a page that
reaches out to a third-party host at load time makes that promise harder to
verify. Vendoring also means the tool keeps working offline.

To update, replace both files from the same release of `pdfjs-dist` and bump the
version noted above.
