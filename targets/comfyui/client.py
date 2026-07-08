"""
HTTP client for the Random AI Prompt engine.

The ComfyUI nodes are thin wrappers: every bit of prompt/engine behaviour runs in the Node engine
behind the app's local backend (``/api/prompt``, ``/api/prompt/catalog``). This module is the only
place that talks to it. Dependency-free (stdlib ``urllib``) so the plugin needs no ``pip install``.

Point-at-running-app model: the nodes call a running Random AI Prompt app (the desktop build or
``npm start``), which serves the backend on ``http://127.0.0.1:4173`` by default. The URL is configured
once — in **Settings → "Random AI Prompt — app URL"** (persisted via ``/random_ai_prompt/config``), or
the ``RANDOM_AI_PROMPT_URL`` environment variable — not per node, so the graph stays uncluttered.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

DEFAULT_URL = "http://localhost:4173"
_TIMEOUT = 60  # seconds — generation is fast, but allow for a cold engine boot on the first call.
# Where the ComfyUI Settings "app URL" is persisted, so it drives BOTH the dropdowns and generation
# (and survives a restart). Lives beside the plugin; gitignored.
_CONFIG_PATH = os.path.join(os.path.dirname(__file__), ".config.json")


class EngineError(RuntimeError):
    """A friendly error when the app/backend can't be reached or returns an error."""


def _load_configured_url() -> str:
    try:
        with open(_CONFIG_PATH, encoding="utf-8") as handle:
            return (json.load(handle).get("url") or "").strip()
    except Exception:  # noqa: BLE001 - no/invalid config file → no configured URL
        return ""


_configured_url = _load_configured_url()


def configured_url() -> str:
    """The URL set via the ComfyUI Settings field (empty if unset)."""
    return _configured_url


def set_configured_url(url: str) -> str:
    """Persist the Settings URL so both the dropdowns and generation use it. Returns the stored value."""
    global _configured_url
    _configured_url = (url or "").strip()
    try:
        with open(_CONFIG_PATH, "w", encoding="utf-8") as handle:
            json.dump({"url": _configured_url}, handle)
    except Exception:  # noqa: BLE001 - best-effort persistence
        pass
    return _configured_url


# Standard ports we auto-detect a running app on when nothing is configured: the desktop / `npm start`
# release server (4173) and the Vite dev server (5173). We use `localhost` (NOT 127.0.0.1) so urllib
# tries BOTH IPv6 (::1) and IPv4 — the Vite dev server binds IPv6-only, the desktop server dual-stack,
# so `localhost` reaches either.
_CANDIDATE_URLS = ["http://localhost:4173", "http://localhost:5173"]
_DETECT_TTL = 10.0  # seconds — re-probe at most this often, so a just-started app is found quickly.
_detect_cache: dict = {"at": 0.0, "url": None}


def _probe(url: str, timeout: float = 1.5) -> bool:
    """True if a REAL Random AI Prompt catalog answers at ``url`` — not just any 200 (a static/SPA
    server would 200 an index.html for an unknown path, which we must not mistake for the API)."""
    try:
        req = urllib.request.Request(
            url.rstrip("/") + "/api/prompt/catalog", headers={"Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if not (200 <= resp.status < 300):
                return False
            data = json.loads(resp.read().decode("utf-8"))
        return isinstance(data, dict) and "lists" in data and "blocks" in data
    except Exception:  # noqa: BLE001 - unreachable / wrong port / not our API
        return False


def _autodetect() -> str | None:
    """Find a running app on a standard port (cached briefly). None if none respond."""
    now = time.time()
    if now - _detect_cache["at"] < _DETECT_TTL:
        return _detect_cache["url"]
    found = next((u for u in _CANDIDATE_URLS if _probe(u)), None)
    _detect_cache.update(at=now, url=found)
    return found


def base_url() -> str:
    """Resolve the backend base URL. Precedence: the Settings URL → the ``RANDOM_AI_PROMPT_URL`` env var
    → an auto-detected running app on a standard port (4173 or 5173) → the default. Slash stripped."""
    url = _configured_url or os.environ.get("RANDOM_AI_PROMPT_URL", "").strip()
    if not url:
        url = _autodetect() or DEFAULT_URL
    return url.rstrip("/")


def _request(method: str, path: str, body: dict | None = None) -> dict:
    target = base_url() + path
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(target, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            payload = resp.read().decode("utf-8")
        return json.loads(payload) if payload else {}
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = json.loads(exc.read().decode("utf-8")).get("error", "")
        except Exception:  # noqa: BLE001 - best-effort error extraction
            detail = ""
        raise EngineError(
            f"Random AI Prompt backend returned {exc.code} for {path}"
            + (f": {detail}" if detail else "")
        ) from exc
    except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
        raise EngineError(
            f"Could not reach the Random AI Prompt app at {base_url()} "
            f"({exc}). Is it running? Start the desktop app or `npm start`, or set the app URL in "
            f"Settings / RANDOM_AI_PROMPT_URL."
        ) from exc


def generate(
    template: str | None = None,
    *,
    seed=None,
    count: int = 1,
    preset: str | None = None,
    settings: dict | None = None,
) -> dict:
    """POST /api/prompt → {"seed", "prompts"}. ``template`` blank = the engine's default random prompt."""
    body: dict = {"count": max(1, int(count or 1))}
    if template is not None and str(template).strip() != "":
        body["template"] = template
    if seed is not None and str(seed).strip() != "":
        body["seed"] = str(seed)
    if preset and preset not in ("", "none"):
        body["preset"] = preset
    if settings:
        body["settings"] = settings
    return _request("POST", "/api/prompt", body)


# --- Catalog (list / block / preset names) for the node dropdowns, cached briefly ---------------

_CATALOG_TTL = 15  # seconds — short, so a running app's edits (Manage) show up on the next menu build.
_catalog_cache: dict = {"at": 0.0, "url": None, "value": None}


def catalog() -> dict:
    """GET /api/prompt/catalog → {"lists","blocks","presets","listGroups","blockGroups"}.

    Best-effort + cached (keyed by the resolved URL, so it re-fetches when the Settings URL changes):
    returns empty lists when the app isn't running, so INPUT_TYPES can fall back to a placeholder
    instead of raising at node-registration time.
    """
    resolved = base_url()
    now = time.time()
    if (
        _catalog_cache["value"] is not None
        and _catalog_cache["url"] == resolved
        and now - _catalog_cache["at"] < _CATALOG_TTL
    ):
        return _catalog_cache["value"]
    try:
        value = _request("GET", "/api/prompt/catalog")
    except EngineError:
        value = {"lists": [], "blocks": [], "presets": [], "listGroups": [], "blockGroups": []}
    _catalog_cache.update(at=now, url=resolved, value=value)
    return value


def _names(key: str, *, extra: list[str] | None = None) -> list[str]:
    """A COMBO option list for a catalog ``key``, with a placeholder when the app is unreachable."""
    names = list(catalog().get(key) or [])
    if not names:
        return ["(start the Random AI Prompt app)"]
    return (extra or []) + names
