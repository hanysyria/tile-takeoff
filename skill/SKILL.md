---
name: tile-takeoff
description: >-
  Read architectural PDF drawings (floor plans, elevations, sections, shop drawings) and
  produce tile, stone or porcelain quantities: render pages at high resolution, zoom into
  dimension strings, pull the text layer, verify the drawing scale, compute the cutting
  layout with the least waste, and total up floors and walls in square metres and boxes.
  Use this skill whenever the user mentions a floor plan, blueprint, shop drawing, DWG or
  CAD export as PDF, a quantity takeoff, "how much tile do I need for this plan", room
  areas from a drawing, drawing scale, slab cutting, offcuts or waste percentage — and
  also whenever a PDF containing architectural drawings is attached, even if the word
  "plan" is never said.
---

# Tile takeoff from architectural drawings

Turn a PDF drawing into quantities somebody can order against, without guessing.

**The governing rule: every number in the output must have a stated source.** It was read
off the drawing, measured by calibration, or assumed — and the output says which. Someone
is going to spend money on these figures.

## The tool

Install once: `pip install "tile-takeoff[all]"`

```bash
# 1) What is this file? Page count, sheet sizes, and text layer vs. scan per page.
tile-takeoff survey plan.pdf

# 2) Render pages to PNG so they can be read (default 150 dpi for an overview)
tile-takeoff render plan.pdf --out ./pages --pages 1,3 --dpi 150

# Zoom into a region: crop by page fractions (x0,y0,x1,y1 from 0 to 1) at higher dpi
tile-takeoff render plan.pdf --out ./pages --pages 2 --dpi 350 --crop 0.5,0,1,0.5

# Sweep a crowded A0/A1 sheet as overlapping tiles
tile-takeoff render plan.pdf --out ./pages --pages 2 --dpi 300 --grid 2x3

# 3) Dump the embedded text layer, if the sheet has one
tile-takeoff text plan.pdf --pages 1-4

# 4) Best cut from a slab, plus quantities and an optional diagram
tile-takeoff optimize --slab 295x175 --floor 1050x810 --area 98 --draw layout.png
```

## Workflow

1. **Survey first.** `survey` tells you whether the file is vector (extractable text,
   usually a CAD export) or a scan (visual reading only), how many sheets, and their size.
2. **Get an overview.** Render at 150 dpi and read the images. Identify the sheets that
   matter: for floor quantities you want the floor plans, not the elevations.
3. **Zoom into the detail.** Dimension text is small and disappears at full-page scale.
   Use `--crop` or `--grid` at 300–400 dpi on the dimension strings, the finishes
   schedule, and the title block. **Never read a number you can't see clearly — zoom
   further instead of guessing.**
4. **Cross-check against the text layer.** Room names and written dimensions confirm what
   you read visually and catch what you missed.
5. **Compute the cut** with `optimize`, then total the quantities.

## Scale and dimensions

- Source priority: **dimensions written on the drawing** > area or finishes schedules >
  measuring against the drawing scale.
- The printed scale (1:50, 1:100…) is not trustworthy on its own: exporting and printing
  change the page size without updating the text. If you must measure off the image,
  **calibrate** pixels per metre against a written dimension in that same image, then
  verify the calibration against a second written dimension before relying on it.
- **Units:** architectural drawings are usually in millimetres (3600 means 3.60 m), but
  centimetres, metres, and feet-and-inches all appear. Infer from context — a wall is
  200–300 mm thick — and state the unit you concluded in the output.

## Computing the quantities

**Floors.** Area per room (length × width, or from the area schedule) plus waste:

- 10% for a straight lay
- 15% for a diagonal lay or a room with many corners
- 15% for large-format tiles (60×120 and above), which get cut more often

**Walls** (bathrooms, kitchens): perimeter × tiling height − openings (doors, windows).
If the openings aren't dimensioned, deduct 10–15% **and say that you did**.

**Cutting from slabs.** For stone or large-format porcelain sold as slabs, run `optimize`
before quoting an area. A cut that divides the slab into an exact grid wastes nothing,
while an off-the-shelf size cut from the same slab can waste 40% or more. Keep the tile
side under about 150 cm — beyond that it is hard to carry and easy to crack.

**Selling units.** Tile is usually sold by the box, not the square metre. Round each line
item up to a whole number of boxes. Square metres per box varies by product — take it from
the product's own datasheet and never assume a single figure across products.

## Output format

Present a table, one row per area:

| Room / area | Item | Net m² | Waste | Total m² | Boxes | Source of the figure |
|---|---|---|---|---|---|---|

Follow it with two short lists:

- **Confidence notes** — what was read off the drawing, what was measured by calibration,
  what was assumed.
- **Open questions** — what the client still has to confirm: tiling height, openings, lay
  direction, which wet areas are in scope.

## Limits and honesty

- A poor scan, or a drawing with no written dimensions: present what could be read and ask
  for the rest explicitly. **Do not produce a takeoff built on guesses.**
- Always distinguish, in words, between "read off the drawing", "measured by calibration",
  and "assumed".
- Exclude what wasn't asked for: lift shafts, stairs, and service risers are usually not
  tiled. When scope is unclear, ask rather than decide.
- This skill produces quantities only. It does not price, quote, or recommend a supplier.

## Arabic and other RTL reports

If you generate a PDF report in Arabic, see `references/rtl_pdf_reports.md` for setting up
a font and avoiding the classic mixed-number reversal bug.
