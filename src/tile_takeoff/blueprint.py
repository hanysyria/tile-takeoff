"""Read architectural PDF drawings: page survey, high-resolution rendering, text layer.

The point of this module is to get a drawing in front of a reader — human or model —
clearly enough that dimensions can be read rather than guessed. Nothing here
interprets the drawing; it only makes it legible.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path

try:  # pragma: no cover - depends on the environment
    import fitz  # PyMuPDF
except ImportError as exc:  # pragma: no cover
    raise ImportError("PyMuPDF is required: pip install pymupdf") from exc

POINTS_PER_INCH = 72
MM_PER_INCH = 25.4
# Tiles are rendered slightly larger than their share of the page so a dimension
# sitting on a seam stays readable in at least one tile.
GRID_OVERLAP = 0.08
# Under this many characters, with an image present, the page is almost certainly a scan.
TEXT_LAYER_THRESHOLD = 20


@dataclass
class PageInfo:
    """What one page of the drawing set is, before anyone reads it."""

    page: int
    width_mm: int
    height_mm: int
    text_chars: int
    images: int
    likely_scanned: bool


def parse_pages(spec: str | None, page_count: int) -> list[int]:
    """Turn "1,3-5" into zero-based [0, 2, 3, 4]. None or "" means every page."""
    if not spec:
        return list(range(page_count))
    pages: list[int] = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            first, last = part.split("-", 1)
            pages.extend(range(int(first) - 1, int(last)))
        else:
            pages.append(int(part) - 1)
    return [p for p in pages if 0 <= p < page_count]


def survey(pdf_path: str | Path) -> dict:
    """Page count, sheet sizes, and whether each page carries a real text layer.

    A page with a text layer was exported from CAD, so written dimensions can be
    pulled out exactly. A scanned page has to be read visually instead.
    """
    with fitz.open(str(pdf_path)) as doc:
        pages = []
        for index, page in enumerate(doc):
            text_chars = len(page.get_text().strip())
            images = len(page.get_images(full=True))
            pages.append(
                PageInfo(
                    page=index + 1,
                    width_mm=round(page.rect.width * MM_PER_INCH / POINTS_PER_INCH),
                    height_mm=round(page.rect.height * MM_PER_INCH / POINTS_PER_INCH),
                    text_chars=text_chars,
                    images=images,
                    likely_scanned=text_chars < TEXT_LAYER_THRESHOLD and images >= 1,
                )
            )
        return {
            "file": str(pdf_path),
            "page_count": len(pages),
            "pages": [asdict(p) for p in pages],
        }


def _clip_rects(page, grid: str | None, crop: str | None) -> list[tuple[str, object]]:
    rect = page.rect
    if grid:
        rows, cols = (int(v) for v in grid.lower().split("x"))
        clips = []
        for row in range(rows):
            for col in range(cols):
                x0 = max(0.0, col / cols - GRID_OVERLAP / 2)
                y0 = max(0.0, row / rows - GRID_OVERLAP / 2)
                x1 = min(1.0, (col + 1) / cols + GRID_OVERLAP / 2)
                y1 = min(1.0, (row + 1) / rows + GRID_OVERLAP / 2)
                clips.append(
                    (
                        f"r{row + 1}c{col + 1}",
                        fitz.Rect(
                            rect.x0 + x0 * rect.width, rect.y0 + y0 * rect.height,
                            rect.x0 + x1 * rect.width, rect.y0 + y1 * rect.height,
                        ),
                    )
                )
        return clips
    if crop:
        x0, y0, x1, y1 = (float(v) for v in crop.split(","))
        return [
            (
                "crop",
                fitz.Rect(
                    rect.x0 + x0 * rect.width, rect.y0 + y0 * rect.height,
                    rect.x0 + x1 * rect.width, rect.y0 + y1 * rect.height,
                ),
            )
        ]
    return [("full", None)]


def render(
    pdf_path: str | Path,
    out_dir: str | Path,
    pages: str | None = None,
    dpi: int = 150,
    crop: str | None = None,
    grid: str | None = None,
) -> list[str]:
    """Write PNGs of the requested pages and return the paths written.

    Use `crop` ("x0,y0,x1,y1" as fractions of the page) to zoom into a dimension
    string or a title block, and `grid` ("2x3") to sweep a crowded A0/A1 sheet
    tile by tile. Dimension text is small: 300–400 dpi on a crop beats 150 dpi
    on the whole sheet every time.
    """
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    zoom = dpi / POINTS_PER_INCH
    stem = Path(pdf_path).stem.replace(" ", "_")
    written: list[str] = []

    with fitz.open(str(pdf_path)) as doc:
        for page_no in parse_pages(pages, len(doc)):
            page = doc[page_no]
            for tag, clip in _clip_rects(page, grid, crop):
                pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip)
                path = out / f"{stem}_p{page_no + 1}_{tag}_{dpi}dpi.png"
                pixmap.save(str(path))
                written.append(str(path))
    return written


def extract_text(pdf_path: str | Path, pages: str | None = None) -> dict[int, str]:
    """The embedded text layer per page, as {page number: text}.

    Empty for scanned sheets. Where it exists, it confirms what was read visually
    and catches room names and dimensions that were missed.
    """
    result: dict[int, str] = {}
    with fitz.open(str(pdf_path)) as doc:
        for page_no in parse_pages(pages, len(doc)):
            result[page_no + 1] = doc[page_no].get_text().strip()
    return result
