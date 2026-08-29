"""Comparison image for the tile-takeoff announcement.

Same slab, two ways of cutting it. The point is the hatched area, so the two
panels share a scale and everything else stays quiet.
"""

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

INK = "#0F1B24"
INK_2 = "#4C606E"
INK_3 = "#7B8D99"
BLUE = "#1B5B87"
TILE_A = "#DCE9F1"
TILE_B = "#C2D8E6"
CUT = "#C24A17"
RULE = "#C3CED6"
GROUND = "#FFFFFF"

SLAB_W, SLAB_H = 295.0, 175.0


def panel(ax, title, tile_w, tile_h, cols, rows, waste, verdict, verdict_colour):
    ax.add_patch(Rectangle((0, 0), SLAB_W, SLAB_H, fc="none", ec=INK, lw=2.2, zorder=5))

    # whole tiles
    for c in range(cols):
        for r in range(rows):
            x, y = c * tile_w, r * tile_h
            ax.add_patch(Rectangle(
                (x, y), tile_w, tile_h,
                fc=TILE_A if (c + r) % 2 == 0 else TILE_B, ec=BLUE, lw=1.1,
            ))

    # what is left over, hatched
    used_w, used_h = cols * tile_w, rows * tile_h
    for x, y, w, h in [
        (used_w, 0, SLAB_W - used_w, SLAB_H),
        (0, used_h, used_w, SLAB_H - used_h),
    ]:
        if w > 0.5 and h > 0.5:
            ax.add_patch(Rectangle(
                (x, y), w, h, fc=CUT, alpha=0.13, ec=CUT, lw=1.1,
                hatch="////", linestyle=(0, (5, 3)),
            ))

    ax.text(0, SLAB_H + 34, title, fontsize=11.5, color=INK_3,
            family="monospace", va="bottom")
    ax.text(0, SLAB_H + 12, f"{tile_w:g} × {tile_h:g} cm",
            fontsize=17, color=INK, weight="bold", va="bottom")
    ax.text(SLAB_W, SLAB_H + 12, waste, fontsize=17, color=verdict_colour,
            weight="bold", va="bottom", ha="right", family="monospace")
    ax.text(SLAB_W, SLAB_H + 36, verdict, fontsize=10.5, color=INK_3,
            va="bottom", ha="right")

    ax.set_xlim(-8, SLAB_W + 8)
    ax.set_ylim(-8, SLAB_H + 66)
    ax.set_aspect("equal")
    ax.axis("off")


fig, axes = plt.subplots(1, 2, figsize=(12.8, 6.7), facecolor=GROUND)
fig.subplots_adjust(left=0.045, right=0.955, top=0.80, bottom=0.14, wspace=0.10)

panel(axes[0], "CUT BY GUESS", 60, 60, 4, 2, "44% wasted", "8 tiles per slab", CUT)
panel(axes[1], "CUT BY PLAN", 147.5, 87.5, 2, 2, "0% wasted", "4 tiles per slab", "#1F6B4F")

fig.text(0.045, 0.945, "The same slab, cut two ways.",
         fontsize=25, color=INK, weight="bold", va="top")
fig.text(0.045, 0.868,
         "Every tiling job adds a blanket 10–20% waste allowance, because nobody computes the cuts. "
         "This one does.",
         fontsize=13.5, color=INK_2, va="top")

fig.text(0.045, 0.045, "tile-takeoff", fontsize=14, color=INK,
         family="monospace", weight="bold", va="bottom")
fig.text(0.955, 0.045, "hanysyria.github.io/tile-takeoff", fontsize=13,
         color=BLUE, family="monospace", va="bottom", ha="right")
fig.add_artist(plt.Line2D([0.045, 0.955], [0.098, 0.098], color=RULE, lw=1))

out = "docs/cut-comparison.png"
fig.savefig(out, dpi=100, facecolor=GROUND, bbox_inches=None)
print(out)
