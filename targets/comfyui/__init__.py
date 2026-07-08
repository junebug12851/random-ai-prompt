"""
Random AI Prompt — ComfyUI custom nodes.

A comprehensive suite of prompt-engine nodes for ComfyUI: the DPL processor, blocks, lists, and
presets from the Random AI Prompt project, surfaced as natural-language-first STRING sources you wire
into a CLIP Text Encode. The nodes are thin wrappers — the real work runs in the project's shared
engine behind a running app's local backend (see ``client.py`` / ``README.md``).

ComfyUI discovers ``NODE_CLASS_MAPPINGS`` / ``NODE_DISPLAY_NAME_MAPPINGS`` here, and serves the
frontend extension in ``web/`` (live catalog dropdowns + a status panel) via ``WEB_DIRECTORY``.
"""

import threading

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
from . import client, routes  # noqa: F401 - routes registers the proxy routes (prints its own status)

def _warm_catalog_cache():
    # Best-effort: warm the catalog off-thread so the first ComfyUI /object_info (which calls every
    # node's INPUT_TYPES synchronously) hits a warm cache instead of a blocking fetch. A failure just
    # leaves the cache cold (nodes fetch on demand) — surface it with a status line, don't crash.
    try:
        client.catalog()
    except Exception as exc:  # noqa: BLE001
        print(f"[Random AI Prompt] catalog warm-up skipped: {exc}")


threading.Thread(target=_warm_catalog_cache, daemon=True).start()

print(f"[Random AI Prompt] loaded {len(NODE_CLASS_MAPPINGS)} nodes")

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
