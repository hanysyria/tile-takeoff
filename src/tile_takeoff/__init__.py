"""tile-takeoff — floor-plan tile quantities and cutting layouts.

Two independent pieces:

* `blueprint` — make a PDF drawing legible (survey, render, text layer).
* `cutting`   — work out the best tile size to cut from a slab, and the quantities.

`blueprint` needs PyMuPDF; `cutting` has no required dependencies.
"""

__version__ = "0.1.0"
__all__ = ["cutting", "blueprint", "__version__"]
