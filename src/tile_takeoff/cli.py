"""Command line interface: `tile-takeoff <command>`."""

from __future__ import annotations

import argparse
import json
import sys

from . import __version__
from .cutting import (
    DEFAULT_ALLOWANCE,
    DEFAULT_MAX_SIDE_CM,
    DEFAULT_MIN_SIDE_CM,
    Takeoff,
    compare_standard_sizes,
    draw_layout,
    fit_to_floor,
    parse_dimensions,
    recommend,
    zero_waste_options,
)

RULE = "─" * 60


def _require_blueprint():
    try:
        from . import blueprint
    except ImportError:
        sys.exit("reading PDFs needs PyMuPDF — install it with: pip install tile-takeoff[pdf]")
    return blueprint


def cmd_survey(args: argparse.Namespace) -> None:
    info = _require_blueprint().survey(args.pdf)
    print(json.dumps(info, ensure_ascii=False, indent=1))


def cmd_render(args: argparse.Namespace) -> None:
    paths = _require_blueprint().render(
        args.pdf, args.out, pages=args.pages, dpi=args.dpi, crop=args.crop, grid=args.grid
    )
    for path in paths:
        print(path)


def cmd_text(args: argparse.Namespace) -> None:
    for page, text in _require_blueprint().extract_text(args.pdf, pages=args.pages).items():
        print(f"===== page {page} =====")
        print(text if text else "(no text layer — this page is a scan)")


def cmd_optimize(args: argparse.Namespace) -> None:
    slab_w, slab_h = parse_dimensions(args.slab)
    slab_m2 = slab_w * slab_h / 10_000.0

    floor_w = floor_h = None
    if args.floor:
        floor_w, floor_h = parse_dimensions(args.floor)

    options = zero_waste_options(slab_w, slab_h, args.min_side, args.max_side)
    best = recommend(slab_w, slab_h, floor_w, floor_h, args.min_side, args.max_side)

    print(RULE)
    print(f"SLAB  {slab_w:g} × {slab_h:g} cm   ({slab_m2:.4f} m²)")
    print(RULE)

    if best is None:
        print(
            f"\nNo zero-waste cut exists between {args.min_side:g} and {args.max_side:g} cm "
            "per side.\nWiden the range with --min-side / --max-side, or accept an "
            "off-the-shelf size below."
        )
    else:
        print(f"\nRECOMMENDED   {best.width_cm:g} × {best.height_cm:g} cm")
        print(
            f"  {best.rows}×{best.cols} cut · {best.per_slab} tiles per slab · "
            f"0.0% waste · {best.area_m2:.3f} m² per tile"
        )
        if floor_w and floor_h:
            fit = fit_to_floor(best.width_cm, best.height_cm, floor_w, floor_h)
            print(
                f"  on this floor: {fit.courses_across} × {fit.tile_width_cm:g}cm across "
                f"(border {fit.border_across_cm:.1f}cm), "
                f"{fit.courses_up} × {fit.tile_height_cm:g}cm up "
                f"(border {fit.border_up_cm:.1f}cm)"
            )

        print("\nZERO-WASTE OPTIONS (largest first)")
        print(f"  {'tile cm':>15}{'per slab':>10}{'m² each':>10}")
        for option in options[:8]:
            size = f"{option.width_cm:.1f}×{option.height_cm:.1f}"
            print(f"  {size:>15}{option.per_slab:>10}{option.area_m2:>10.3f}")

    print("\nOFF-THE-SHELF SIZES (for comparison)")
    print(f"  {'tile cm':>15}{'per slab':>10}{'waste':>10}")
    for w, h, count, waste in compare_standard_sizes(slab_w, slab_h):
        print(f"  {f'{w:g}×{h:g}':>15}{count:>10}{waste * 100:>9.1f}%")

    area = args.area if args.area else (floor_w * floor_h / 10_000.0 if floor_w else None)
    if area and best:
        quantities = Takeoff(area, best.area_m2, slab_m2, args.allowance)
        print("\n" + RULE)
        print(f"QUANTITIES   floor = {area:.2f} m²")
        print(f"  tiles needed            : {quantities.tiles_needed}")
        print(f"  slabs, no allowance     : {quantities.slabs_bare}")
        print(f"  slabs, +{args.allowance * 100:.0f}% allowance   : {quantities.slabs_with_allowance}")

    if args.draw:
        if not best:
            print("\nNothing to draw: no zero-waste option was found.")
        else:
            print(f"\nsaved {draw_layout(slab_w, slab_h, best, args.draw, floor_w, floor_h)}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="tile-takeoff",
        description="Read floor plans and compute tile quantities with a real cutting layout.",
    )
    parser.add_argument("--version", action="version", version=f"tile-takeoff {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("survey", help="page count, sheet sizes, scan-or-vector per page")
    p.add_argument("pdf")
    p.set_defaults(func=cmd_survey)

    p = sub.add_parser("render", help="render pages to PNG, optionally cropped or tiled")
    p.add_argument("pdf")
    p.add_argument("--out", required=True, help="output directory")
    p.add_argument("--pages", help="e.g. 1,3-5 (default: all)")
    p.add_argument("--dpi", type=int, default=150)
    p.add_argument("--crop", help="x0,y0,x1,y1 as fractions of the page, 0..1")
    p.add_argument("--grid", help="sweep the sheet as RxC overlapping tiles, e.g. 2x3")
    p.set_defaults(func=cmd_render)

    p = sub.add_parser("text", help="dump the embedded text layer")
    p.add_argument("pdf")
    p.add_argument("--pages")
    p.set_defaults(func=cmd_text)

    p = sub.add_parser("optimize", help="best cut for a slab, and quantities")
    p.add_argument("--slab", required=True, help="raw slab size in cm, e.g. 295x175")
    p.add_argument("--area", type=float, help="floor area in m²")
    p.add_argument("--floor", help="room size in cm, e.g. 1050x810")
    p.add_argument("--max-side", type=float, default=DEFAULT_MAX_SIDE_CM)
    p.add_argument("--min-side", type=float, default=DEFAULT_MIN_SIDE_CM)
    p.add_argument("--allowance", type=float, default=DEFAULT_ALLOWANCE, help="e.g. 0.10 for 10%%")
    p.add_argument("--draw", help="write a layout diagram to this PNG path")
    p.set_defaults(func=cmd_optimize)

    return parser


def main(argv: list[str] | None = None) -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
