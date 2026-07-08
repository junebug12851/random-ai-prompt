"""
Same-origin proxy routes registered on ComfyUI's own web server.

The browser extension (``web/randomAiPrompt.js``) can't fetch the Random AI Prompt backend directly —
it's a different origin and the app backend sends no CORS headers. So these tiny routes live on
ComfyUI's server (same origin as the page) and forward to the app via ``client.py`` (server-to-server,
no CORS). The blocking ``urllib`` calls run in a thread so they never stall ComfyUI's event loop.

Registration is best-effort, but NOT silent: outside ComfyUI (or if ComfyUI's server API changes) it
prints why, so a broken connection is diagnosable from the ComfyUI console rather than a mystery.
"""

from __future__ import annotations

import asyncio
import traceback

from . import client


def _register() -> None:
    from aiohttp import web
    from server import PromptServer

    routes = PromptServer.instance.routes

    @routes.get("/random_ai_prompt/catalog")
    async def _catalog(_request):
        cat = await asyncio.to_thread(client.catalog)
        return web.json_response(cat)

    @routes.get("/random_ai_prompt/status")
    async def _status(_request):
        def probe():
            try:
                cat = client.catalog()
                return {"ok": bool(cat.get("lists")), "url": client.base_url()}
            except Exception:  # noqa: BLE001
                return {"ok": False, "url": client.base_url()}

        return web.json_response(await asyncio.to_thread(probe))

    @routes.get("/random_ai_prompt/config")
    async def _config_get(_request):
        return web.json_response({"url": client.configured_url()})

    @routes.post("/random_ai_prompt/config")
    async def _config_post(request):
        try:
            body = await request.json()
        except Exception:  # noqa: BLE001 - tolerate an empty/invalid body
            body = {}
        url = client.set_configured_url((body or {}).get("url", ""))
        return web.json_response({"url": url})


try:
    _register()
    _cfg = client.configured_url()
    print(
        "[Random AI Prompt] server routes registered — app URL: "
        + (_cfg or "(auto-detect on 4173/5173, or set it in Settings)")
    )
except Exception:  # noqa: BLE001 - outside ComfyUI, or the server API changed
    print(
        "[Random AI Prompt] WARNING: could not register the /random_ai_prompt/* server routes, so the "
        "live dropdowns, the Settings URL field, and the sidebar will not work. Generation still works "
        "if the app is auto-detected (4173/5173) or RANDOM_AI_PROMPT_URL is set. Reason:"
    )
    traceback.print_exc()
