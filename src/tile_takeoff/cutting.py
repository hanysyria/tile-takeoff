"""Cutting-layout optimisation for slabs and tiles.

Given a raw slab size and (optionally) a room, work out which finished tile size
yields the least waste while staying large enough to look good and small enough
to actually handle on site.

Every dimension in this module is in centimetres unless the name says otherwise.
Areas are in square metres.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

# A tile longer than this on any side is awkward to carry and easy to crack.
DEFAULT_MAX_SIDE_CM = 150.0
# Below this a "large format" cut stops being large format.
DEFAULT_MIN_SIDE_CM = 40.0
# Extra material ordered to cover breakage and site cuts.
DEFAULT_ALLOWANCE = 0.10
# Largest number of cuts per axis worth considering.
MAX_DIVISIONS = 12

# Sizes sold off the shelf, used as a reference point in comparisons.
STANDARD_SIZES_CM = [(60, 60), (80, 80), (60, 120), (75, 75), (100, 100), (90, 90)]


def parse_dimensions(text: str) -> tuple[float, float]:
    """Parse "295x175", "295 X 175", "295*175" or "295×175" into (295.0, 175.0)."""
    cleaned = text.lower().replace("×", "x").replace("*", "x").replace(" ", "")
    if "x" not in cleaned:
        raise ValueError(f"expected a size like 295x175, got {text!r}")
    a, b = cleaned.split("x", 1)
    width, height = float(a), float(b)
    if width <= 0 or height <= 0:
        raise ValueError(f"dimensions must be positive, got {text!r}")
    return width, height


@dataclass(frozen=True)
class TileOption:
    """One candidate finished tile size cut out of the slab."""

    width_cm: float
    height_cm: float
    rows: int
    cols: int

    @property
    def per_slab(self) -> int:
        return self.rows * self.cols

    @property
    def area_m2(self) -> float:
        return self.width_cm * self.height_cm / 10_000.0

    def waste_fraction(self, slab_width_cm: float, slab_height_cm: float) -> float:
        slab_area = slab_width_cm * slab_height_cm
        return (slab_area - self.per_slab * self.width_cm * self.height_cm) / slab_area


@dataclass(frozen=True)
class FloorFit:
    """How a tile size lands on a specific room, in its better orientation."""

    tile_width_cm: float
    tile_height_cm: float
    courses_across: int
    courses_up: int
    border_across_cm: float
    border_up_cm: float

    @property
    def total_border_cm(self) -> float:
        return self.border_across_cm + self.border_up_cm


@dataclass
class Takeoff:
    """Quantities for one area, given a chosen tile."""

    area_m2: float
    tile_area_m2: float
    slab_area_m2: float
    allowance: float = DEFAULT_ALLOWANCE
    tiles_needed: int = field(init=False)
    slabs_bare: int = field(init=False)
    slabs_with_allowance: int = field(init=False)

    def __post_init__(self) -> None:
        self.tiles_needed = math.ceil(self.area_m2 / self.tile_area_m2)
        self.slabs_bare = math.ceil(self.area_m2 / self.slab_area_m2)
        self.slabs_with_allowance = math.ceil(
            self.area_m2 * (1 + self.allowance) / self.slab_area_m2
        )


def tiles_per_slab(
    slab_width_cm: float, slab_height_cm: float, tile_width_cm: float, tile_height_cm: float
) -> int:
    """How many whole tiles fit on the slab, trying both tile orientations."""

    def fit(w: float, h: float) -> int:
        return int(slab_width_cm // w) * int(slab_height_cm // h)

    return max(fit(tile_width_cm, tile_height_cm), fit(tile_height_cm, tile_width_cm))


def zero_waste_options(
    slab_width_cm: float,
    slab_height_cm: float,
    min_side_cm: float = DEFAULT_MIN_SIDE_CM,
    max_side_cm: float = DEFAULT_MAX_SIDE_CM,
) -> list[TileOption]:
    """Every tile size that divides the slab into an exact grid, largest first.

    A cut that splits the slab into equal rows and columns leaves nothing over,
    so these options waste no material at the slab — only at the room's edges.
    """
    options: list[TileOption] = []
    seen: set[tuple[float, float]] = set()

    for rows in range(1, MAX_DIVISIONS + 1):
        for cols in range(1, MAX_DIVISIONS + 1):
            width = slab_width_cm / rows
            height = slab_height_cm / cols
            shorter, longer = min(width, height), max(width, height)
            if shorter < min_side_cm - 1e-9 or longer > max_side_cm + 1e-9:
                continue
            key = (round(width, 2), round(height, 2))
            if key in seen:
                continue
            seen.add(key)
            options.append(TileOption(width, height, rows, cols))

    return sorted(options, key=lambda o: -o.area_m2)


def fit_to_floor(
    tile_width_cm: float, tile_height_cm: float, floor_width_cm: float, floor_height_cm: float
) -> FloorFit:
    """Pick the tile orientation that leaves the smallest strip to cut at the walls."""
    best: FloorFit | None = None
    for w, h in ((tile_width_cm, tile_height_cm), (tile_height_cm, tile_width_cm)):
        across = int(floor_width_cm // w)
        up = int(floor_height_cm // h)
        candidate = FloorFit(
            tile_width_cm=w,
            tile_height_cm=h,
            courses_across=across,
            courses_up=up,
            border_across_cm=floor_width_cm - across * w,
            border_up_cm=floor_height_cm - up * h,
        )
        if best is None or candidate.total_border_cm < best.total_border_cm:
            best = candidate
    assert best is not None
    return best


def recommend(
    slab_width_cm: float,
    slab_height_cm: float,
    floor_width_cm: float | None = None,
    floor_height_cm: float | None = None,
    min_side_cm: float = DEFAULT_MIN_SIDE_CM,
    max_side_cm: float = DEFAULT_MAX_SIDE_CM,
) -> TileOption | None:
    """The largest zero-waste tile; ties broken by how cleanly it lands on the room."""
    options = zero_waste_options(slab_width_cm, slab_height_cm, min_side_cm, max_side_cm)
    if not options:
        return None
    if floor_width_cm and floor_height_cm:
        return sorted(
            options,
            key=lambda o: (
                -o.area_m2,
                fit_to_floor(o.width_cm, o.height_cm, floor_width_cm, floor_height_cm).total_border_cm,
            ),
        )[0]
    return options[0]


def compare_standard_sizes(
    slab_width_cm: float, slab_height_cm: float
) -> list[tuple[int, int, int, float]]:
    """(width, height, tiles per slab, waste fraction) for each off-the-shelf size."""
    slab_area = slab_width_cm * slab_height_cm
    rows = []
    for w, h in STANDARD_SIZES_CM:
        count = tiles_per_slab(slab_width_cm, slab_height_cm, w, h)
        rows.append((w, h, count, (slab_area - count * w * h) / slab_area))
    return rows


def draw_layout(
    slab_width_cm: float,
    slab_height_cm: float,
    option: TileOption,
    path: str,
    floor_width_cm: float | None = None,
    floor_height_cm: float | None = None,
) -> str:
    """Save a diagram of the slab cut, plus the room layout when a room is given.

    Requires matplotlib, which is an optional extra: `pip install tile-takeoff[draw]`.
    """
    try:
        import matplotlib
    except ImportError as exc:  # pragma: no cover - depends on the environment
        raise RuntimeError(
            "drawing needs matplotlib — install it with: pip install tile-takeoff[draw]"
        ) from exc

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle

    show_floor = bool(floor_width_cm and floor_height_cm)
    panels = 2 if show_floor else 1
    fig, axes = plt.subplots(1, panels, figsize=(7.2 * panels, 5.0))
    axes = [axes] if panels == 1 else list(axes)

    tile_fills = ("#E5EEF4", "#D2E1EB")
    tile_edge = "#1B5B87"
    offcut_fill = "#F6E3DA"

    slab_ax = axes[0]
    slab_ax.add_patch(Rectangle((0, 0), slab_width_cm, slab_height_cm, fill=False, lw=3, ec="#3A4B57"))
    tw, th = option.width_cm, option.height_cm
    for col in range(option.cols):
        for row in range(option.rows):
            slab_ax.add_patch(
                Rectangle(
                    (row * tw + 1, col * th + 1), tw - 2, th - 2,
                    fc=tile_fills[(row + col) % 2], ec=tile_edge, lw=1.4,
                )
            )
    slab_ax.set_title(
        f"slab {slab_width_cm:g}×{slab_height_cm:g} → "
        f"{option.per_slab} × ({tw:g}×{th:g}) · 0% waste",
        fontsize=12, weight="bold", color="#0F1B24",
    )
    slab_ax.set_xlim(-10, slab_width_cm + 10)
    slab_ax.set_ylim(-10, slab_height_cm + 10)
    slab_ax.set_aspect("equal")
    slab_ax.axis("off")

    if show_floor:
        assert floor_width_cm and floor_height_cm
        floor_ax = axes[1]
        fit = fit_to_floor(tw, th, floor_width_cm, floor_height_cm)
        floor_ax.add_patch(
            Rectangle((0, 0), floor_width_cm, floor_height_cm, fill=False, lw=3, ec="#3A4B57")
        )
        x = 0.0
        column = 0
        while x < floor_width_cm - 1:
            w = min(fit.tile_width_cm, floor_width_cm - x)
            y = 0.0
            while y < floor_height_cm - 1:
                h = min(fit.tile_height_cm, floor_height_cm - y)
                whole = abs(w - fit.tile_width_cm) < 0.5 and abs(h - fit.tile_height_cm) < 0.5
                floor_ax.add_patch(
                    Rectangle(
                        (x + 0.6, y + 0.6), w - 1.2, h - 1.2,
                        fc=tile_fills[column % 2] if whole else offcut_fill,
                        ec=tile_edge, lw=0.6,
                    )
                )
                y += fit.tile_height_cm
            x += fit.tile_width_cm
            column += 1
        floor_ax.set_title(
            f"floor {floor_width_cm:g}×{floor_height_cm:g} · "
            f"{fit.courses_across} courses of {fit.tile_width_cm:g}cm",
            fontsize=12, weight="bold", color="#0F1B24",
        )
        floor_ax.set_xlim(-10, floor_width_cm + 10)
        floor_ax.set_ylim(-10, floor_height_cm + 10)
        floor_ax.set_aspect("equal")
        floor_ax.axis("off")

    plt.tight_layout()
    plt.savefig(path, dpi=130, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path
