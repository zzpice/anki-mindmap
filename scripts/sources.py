"""Small build-time includes; exported Anki templates contain no directives."""
from pathlib import Path
import re

CARDS = Path(__file__).resolve().parents[1] / "cards"
INCLUDE = re.compile(r"<!-- include:([^\s]+) -->|/\* include:([^\s]+) \*/")


def read_source(name, *, root=CARDS):
    root = Path(root).resolve()

    def expand(name, ancestors=()):
        path = (root / name).resolve()
        if not path.is_relative_to(root):
            raise ValueError("Include outside cards/: " + name)
        if path in ancestors:
            raise ValueError("Circular include: " + name)
        text = path.read_text(encoding="utf-8")
        if path.suffix not in (".html", ".css"):
            return text
        return INCLUDE.sub(lambda match: expand(match[1] or match[2], (*ancestors, path)), text)

    return expand(name)
