"""
Same-origin proxy routes registered on ComfyUI's own web server.

The browser extension (``web/randomAiPrompt.js``) can't fetch the Random AI Prompt backend directly —
it's a different origin and the app backend sends no CORS headers. So these tiny routes live on
ComfyUI's server (same origin as the page) and forward to the app via ``client.py`` (server-to-server,
no CORS). The blocking ``urllib`` calls run in a thread so they never stall ComfyUI's event loop.

Registration is best-effort: outside ComfyUI (syntax check / standalone import) there's no
``PromptServer``, so this module is a no-op rather than an error.
"""

from __future__ import annotations

import asyncio

from . import client

try:  # pragma: no cover - only runs inside ComfyUI
    from aiohttp import web
    from server import PromptServer

    _routes = PromptServer.instance.routes

    @_routes.get("/random_ai_prompt/catalog")
    async def _catalog(_request):
        cat = await asyncio.to_thread(client.catalog)
        return web.json_response(cat)

    @_routes.get("/random_ai_prompt/status")
    async def _status(_request):
        def _probe():
            try:
                cat = client.catalog()
                return {"ok": bool(cat.get("lists")), "url": client.base_url()}
            except Exception:  # noqa: BLE001
                return {"ok": False, "url": client.base_url()}

        return web.json_response(await asyncio.to_thread(_probe))

    @_routes.get("/random_ai_prompt/config")
    async def _config_get(_request):
        return web.json_response({"url": client.configured_url()})

    @_routes.post("/random_ai_prompt/config")
    async def _config_post(request):
        try:
            body = await request.json()
        except Exception:  # noqa: BLE001 - tolerate an empty/invalid body
            body = {}
        url = client.set_configured_url((body or {}).get("url", ""))
        return web.json_response({"url": url})

except Exception:  # noqa: BLE001 - not inside ComfyUI; routes are optional
    pass
