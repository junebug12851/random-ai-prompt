"""
Random AI Prompt — ComfyUI custom nodes.

A comprehensive suite of prompt-engine nodes for ComfyUI: the DPL processor, blocks, lists, and
presets from the Random AI Prompt project, surfaced as natural-language-first STRING sources you wire
into a CLIP Text Encode. The nodes are thin wrappers — the real work runs in the project's shared
engine behind a running app's local backend (see ``client.py`` / ``README.md``).

ComfyUI discovers ``NODE_CLASS_MAPPINGS`` / ``NODE_DISPLAY_NAME_MAPPINGS`` here, and serves the
frontend extension in ``web/`` (live catalog dropdowns + a status panel) via ``WEB_DIRECTORY``.
"""

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
from . import routes  # noqa: F401 - registers same-origin proxy routes (prints its own status)

print(f"[Random AI Prompt] loaded {len(NODE_CLASS_MAPPINGS)} nodes")

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
