# Arabic (and other RTL) PDF reports

Notes from generating takeoff reports in Arabic. The failure mode is silent: the PDF
builds without error and the Arabic renders as empty boxes, or the numbers come out
backwards. Both are avoidable.

## 1. A renderer

```bash
pip install weasyprint
```

WeasyPrint needs pango, cairo and harfbuzz from the system, which are usually already
present on Linux and installable on macOS via Homebrew.

## 2. A font that actually has Arabic glyphs

Most default PDF fonts don't. On a machine without root access, the reliable route is to
fetch a font as a package and install it into the user font directory:

```bash
npm install @fontsource/cairo @fontsource/amiri @fontsource/noto-kufi-arabic
```

The files land as woff2 under `node_modules/@fontsource/<font>/files/`. Convert them to
TTF and register them for the current user:

```bash
pip install fonttools brotli
```

```python
import os
from fontTools.ttLib import TTFont

dest = os.path.expanduser("~/.fonts")
os.makedirs(dest, exist_ok=True)

for src, out in [
    ("node_modules/@fontsource/cairo/files/cairo-arabic-400-normal.woff2", "Cairo-Regular.ttf"),
    ("node_modules/@fontsource/cairo/files/cairo-arabic-700-normal.woff2", "Cairo-Bold.ttf"),
]:
    font = TTFont(src)
    font.flavor = None          # strip woff2 compression
    font.save(os.path.join(dest, out))
```

```bash
fc-cache -f ~/.fonts
fc-list | grep -i cairo        # confirm it registered
```

In CSS: `font-family: 'Cairo'` for UI and tables, Amiri for long running text, Noto Kufi
Arabic for headings — with `direction: rtl` on the container.

## 3. The mixed-number reversal bug

This one catches everybody. Any value that mixes digits with a symbol or Arabic text —
`147.5 × 87.5`, `~85 m²`, `10%` — gets reordered by the bidirectional algorithm and comes
out reversed or scrambled. Isolate the number:

```css
.ltr { direction: ltr; unicode-bidi: isolate; display: inline-block; }
```

Keep the unit *outside* the span so it stays in the Arabic flow:

```html
<span class="ltr">147.5 × 87.5</span> سم
<span class="ltr">~85</span> م²
```

## 4. Always verify visually

The PDF building successfully proves nothing. Render it back to an image and look:

```bash
pdftoppm -r 90 -png report.pdf check
```

Then open `check-1.png` and confirm the Arabic is joined script and not a row of boxes,
and that every number reads in the right order.
