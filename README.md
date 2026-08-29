# tile-takeoff

**Tile quantities computed from a floor plan, not guessed.**

[العربية](README.ar.md) · MIT licensed · Python 3.10+

Every tiling job starts with the same question: how many square metres do we need?
Because almost nobody works it out properly, the habit across the industry is to add a
blanket waste allowance — usually 10–20% over the net area. That number isn't an
estimate. It's insurance against not knowing how the tiles will be cut.

Two things end up in the skip: money spent on material that was never laid, and the
material itself. Broken ceramic is among the hardest construction waste to recycle, so
it goes to landfill.

This tool replaces the guess with a calculation. Point it at a PDF drawing, give it the
slab or tile size, and it returns the cutting layout, the real waste percentage, and the
quantity to order.

```
SLAB  295 × 175 cm   (5.1625 m²)

RECOMMENDED   147.5 × 87.5 cm
  2×2 cut · 4 tiles per slab · 0.0% waste · 1.291 m² per tile
  on this floor: 7 × 147.5cm across (border 17.5cm), 9 × 87.5cm up (border 22.5cm)

OFF-THE-SHELF SIZES (for comparison)
          tile cm  per slab     waste
            60×60         8     44.2%
            80×80         6     25.6%
           60×120         4     44.2%

QUANTITIES   floor = 98.00 m²
  tiles needed            : 76
  slabs, +10% allowance   : 21
```

Cutting that same slab into 60×60 tiles throws away 44% of it. The tool doesn't decide
for you — it shows you what each choice costs.

## Install

```bash
pip install "tile-takeoff[all]"
```

`[all]` pulls in PyMuPDF for reading PDFs and matplotlib for the layout diagram. The
cutting maths itself has no dependencies at all — `pip install tile-takeoff` is enough
if you already know your areas.

## Use it

**Survey the drawing** — how many sheets, what size, and whether each page carries a real
text layer (exported from CAD) or is a scan that has to be read by eye:

```bash
tile-takeoff survey plan.pdf
```

**Render pages** so they can actually be read. Dimension text is small; a crop at 350 dpi
beats the whole sheet at 150 dpi every time:

```bash
tile-takeoff render plan.pdf --out ./pages --pages 1,3 --dpi 150
tile-takeoff render plan.pdf --out ./pages --pages 2 --dpi 350 --crop 0.5,0,1,0.5
tile-takeoff render plan.pdf --out ./pages --pages 2 --dpi 300 --grid 2x3
```

`--crop` takes fractions of the page (`x0,y0,x1,y1`, each 0–1). `--grid` sweeps a crowded
A0/A1 sheet as overlapping tiles, so a dimension sitting on a seam still lands whole in
one of them.

**Pull the text layer**, which confirms what you read visually and catches what you missed:

```bash
tile-takeoff text plan.pdf --pages 1-4
```

**Work out the cut and the quantities:**

```bash
tile-takeoff optimize --slab 295x175
tile-takeoff optimize --slab 295x175 --area 98
tile-takeoff optimize --slab 295x175 --floor 1050x810 --area 98 --draw layout.png
```

| Flag | Meaning |
|---|---|
| `--slab` | raw slab size in cm, e.g. `295x175` |
| `--area` | floor area in m² |
| `--floor` | room size in cm, so the tool can pick the orientation with the smallest offcut |
| `--max-side` | largest practical tile side, default 150 cm — above that they're hard to carry and easy to crack |
| `--min-side` | smallest side worth considering, default 40 cm |
| `--allowance` | breakage and site-cut allowance, default `0.10` |
| `--draw` | write a layout diagram to a PNG |

## As a library

```python
from tile_takeoff.cutting import recommend, fit_to_floor, Takeoff

best = recommend(295, 175, floor_width_cm=1050, floor_height_cm=810)
print(best.width_cm, best.height_cm, best.per_slab)     # 147.5 87.5 4

quantities = Takeoff(area_m2=98, tile_area_m2=best.area_m2, slab_area_m2=5.1625)
print(quantities.slabs_with_allowance)                   # 21
```

```python
from tile_takeoff.blueprint import survey, render, extract_text
```

## As an agent skill

`skill/` holds an installable [Agent Skill](https://docs.claude.com/en/docs/agents-and-tools/agent-skills)
that teaches a coding agent to drive this tool: how to read a drawing without guessing,
how to verify the scale, and where it must stop and ask instead of inventing a number.
Copy the folder into `~/.claude/skills/tile-takeoff/`.

## What it will not do

**Never guess a dimension.** A drawing with no written dimensions and no readable scale
produces a request for information, not a takeoff. Somebody is going to spend money on
this number.

**Never trust the printed scale alone.** Exporting and printing change the page size
without updating the "1:50" printed on it. To measure off an image, calibrate pixels per
metre against a *written* dimension in that same image, then check the calibration
against a second written dimension before relying on it.

**Watch the units.** Architectural drawings are usually in millimetres — `3600` means
3.60 m — but not always. Infer from context (a wall is 200–300 mm thick) and state which
unit you concluded.

**Say where every number came from.** Read off the drawing, measured by calibration, or
assumed — these are three different levels of confidence and the output should never blur
them.

## Waste allowances

The defaults are conventional, not laws of physics:

- 10% for a straight lay
- 15% for a diagonal lay, rooms with many corners, or large-format tiles (60×120 and up),
  because more tiles get cut
- Natural stone runs slightly higher than porcelain — raise it when in doubt

Once the cutting layout is actually computed, the allowance covers breakage and site
error rather than ignorance, which is why it can come down.

## Development

```bash
git clone https://github.com/hanysyria/tile-takeoff.git && cd tile-takeoff
pip install -e ".[dev]"
pytest
python examples/make_example_plan.py   # regenerate the synthetic test drawing
```

`examples/example_plan.pdf` is generated by the repo itself — a small synthetic sheet with
four rooms and written dimensions. No real project drawings are included, and none should
be: a floor plan is somebody's home.

## Contributing

Issues and pull requests welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Particularly
useful: drawings in units or conventions the reader mishandles, tile shapes it doesn't
model (hexagons, herringbone, borders), and translations.
