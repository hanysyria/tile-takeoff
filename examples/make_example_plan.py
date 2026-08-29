"""Generate examples/example_plan.pdf — a small synthetic floor plan.

Real client drawings can't be shipped, so the repo carries a plan it draws itself:
three rooms, written dimensions in millimetres, and a title block, exported as
vector PDF so the text layer is real.
"""
from pathlib import Path

import fitz

MM = 72 / 25.4
INK = (0.06, 0.11, 0.14)
BLUE = (0.11, 0.36, 0.53)

# name, x, y, width, height — in millimetres on the sheet, 1:50 of a real room
ROOMS = [
    ("MAJLIS", 20, 25, 96, 72),
    ("DINING", 120, 25, 72, 72),
    ("BATH", 120, 101, 72, 40),
    ("HALL", 20, 101, 96, 40),
]


def main() -> Path:
    out = Path(__file__).with_name("example_plan.pdf")
    doc = fitz.open()
    page = doc.new_page(width=210 * MM, height=180 * MM)  # a small A5-ish sheet

    page.insert_text((20 * MM, 16 * MM), "GROUND FLOOR PLAN", fontsize=13,
                     fontname="hebo", color=INK)
    page.insert_text((20 * MM, 21 * MM), "scale 1:50   ·   dimensions in mm",
                     fontsize=7, color=BLUE)

    for name, x, y, w, h in ROOMS:
        rect = fitz.Rect(x * MM, y * MM, (x + w) * MM, (y + h) * MM)
        page.draw_rect(rect, color=INK, width=1.6)
        page.insert_text((x * MM + 4, y * MM + 12), name, fontsize=8,
                         fontname="hebo", color=INK)
        # room size at 1:50 — 96 mm on paper is 4800 mm on site
        page.insert_text((x * MM + 4, y * MM + 22),
                         f"{w * 50:.0f} x {h * 50:.0f}", fontsize=7, color=BLUE)
        page.insert_text((x * MM + 4, y * MM + 31),
                         f"{w * 50 * h * 50 / 1e6:.2f} m2", fontsize=6.5, color=BLUE)

    page.draw_rect(fitz.Rect(20 * MM, 150 * MM, 192 * MM, 168 * MM),
                   color=BLUE, width=1)
    page.insert_text((24 * MM, 158 * MM), "EXAMPLE DRAWING — tile-takeoff",
                     fontsize=8, fontname="hebo", color=INK)
    page.insert_text((24 * MM, 164 * MM),
                     "synthetic sheet for testing; not a real project", fontsize=6.5,
                     color=BLUE)

    doc.save(out)
    doc.close()
    print(out)
    return out


if __name__ == "__main__":
    main()
