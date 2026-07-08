"""
Random AI Prompt — ComfyUI nodes.

Prompt-side only: ComfyUI already owns image generation, upscaling, variations, and re-roll (its native
seed widget). These nodes bring the *prompt* engine — the DPL processor, blocks, lists, and presets —
into the graph as natural-language-first STRING sources you feed into a CLIP Text Encode.

Every node is a thin wrapper: the real work happens in the shared engine behind the running app's
backend (see ``client.py``). The flagship ``RandomAIPromptGenerator`` does ~90% of the work; the rest
are small helpers.

The ``seed`` widget carries ComfyUI's native ``control_after_generate`` — set it to *randomize* to
re-roll a fresh prompt each run, or *fixed* to reproduce one. Same inputs → same prompt (cached).
"""

from __future__ import annotations

from . import client

CATEGORY = "Random AI Prompt"
_SEED = ("INT", {"default": 0, "min": 0, "max": 0xFFFFFFFFFFFFFFFF, "control_after_generate": True})
_SERVER_URL = ("STRING", {"default": "", "multiline": False})


def _first(result: dict) -> str:
    prompts = result.get("prompts") or []
    return prompts[0] if prompts else ""


class RandomAIPromptGenerator:
    """The flagship node: a natural-language / DPL template in, a rich generated prompt out."""

    @classmethod
    def INPUT_TYPES(cls):
        presets = ["none"] + list(client.catalog().get("presets") or [])
        return {
            "required": {
                "template": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "",
                        "placeholder": "Leave blank for a fully random prompt, or type DPL, e.g. "
                        "a photo of {#subject}, {#style}, {#lighting}",
                    },
                ),
                "seed": _SEED,
                "nsfw": ("BOOLEAN", {"default": False}),
                "preset": (presets,),
            },
            "optional": {"server_url": _SERVER_URL},
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "generate"
    CATEGORY = CATEGORY

    def generate(self, template, seed, nsfw, preset, server_url=""):
        result = client.generate(
            template=template,
            seed=seed,
            preset=preset,
            settings={"includeAdult": bool(nsfw)},
            url=server_url,
        )
        return (_first(result),)

    @classmethod
    def IS_CHANGED(cls, template, seed, nsfw, preset, server_url=""):
        return f"{template}|{seed}|{nsfw}|{preset}|{server_url}"


class RandomAIPromptList:
    """Helper: draw one random entry from a named word list (``{list}``)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"list_name": (client._names(None, "lists"),), "seed": _SEED},
            "optional": {"server_url": _SERVER_URL},
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    CATEGORY = CATEGORY

    def run(self, list_name, seed, server_url=""):
        return (_first(client.generate(template="{" + list_name + "}", seed=seed, url=server_url)),)

    @classmethod
    def IS_CHANGED(cls, list_name, seed, server_url=""):
        return f"{list_name}|{seed}|{server_url}"


class RandomAIPromptBlock:
    """Helper: run one block generator (``{#block}``) — a scene / subject / style fragment."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"block_name": (client._names(None, "blocks"),), "seed": _SEED},
            "optional": {"server_url": _SERVER_URL},
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    CATEGORY = CATEGORY

    def run(self, block_name, seed, server_url=""):
        return (_first(client.generate(template="{#" + block_name + "}", seed=seed, url=server_url)),)

    @classmethod
    def IS_CHANGED(cls, block_name, seed, server_url=""):
        return f"{block_name}|{seed}|{server_url}"


class RandomAIPromptDPL:
    """Helper (power users): expand any raw DPL template — the DPL processor, unadorned."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "template": ("STRING", {"multiline": True, "default": "{#any}"}),
                "seed": _SEED,
                "nsfw": ("BOOLEAN", {"default": False}),
            },
            "optional": {"server_url": _SERVER_URL},
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    CATEGORY = CATEGORY

    def run(self, template, seed, nsfw, server_url=""):
        result = client.generate(
            template=template, seed=seed, settings={"includeAdult": bool(nsfw)}, url=server_url
        )
        return (_first(result),)

    @classmethod
    def IS_CHANGED(cls, template, seed, nsfw, server_url=""):
        return f"{template}|{seed}|{nsfw}|{server_url}"


class RandomAIPromptRewrite:
    """Helper: rewrite a prompt through a text provider (auto-fix or keyword-translate). BYOK."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prompt": ("STRING", {"multiline": True, "default": "", "forceInput": True}),
                "provider": ("STRING", {"default": "openai"}),
                "api_key": ("STRING", {"default": "", "multiline": False, "password": True}),
                "mode": (["fix", "keyword"],),
            },
            "optional": {"server_url": _SERVER_URL},
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "run"
    CATEGORY = CATEGORY

    def run(self, prompt, provider, api_key, mode, server_url=""):
        result = client.rewrite(prompt, provider, api_key, mode=mode, url=server_url)
        return (result.get("prompt") or result.get("text") or prompt,)


NODE_CLASS_MAPPINGS = {
    "RandomAIPromptGenerator": RandomAIPromptGenerator,
    "RandomAIPromptList": RandomAIPromptList,
    "RandomAIPromptBlock": RandomAIPromptBlock,
    "RandomAIPromptDPL": RandomAIPromptDPL,
    "RandomAIPromptRewrite": RandomAIPromptRewrite,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RandomAIPromptGenerator": "🎲 Random AI Prompt",
    "RandomAIPromptList": "🎲 Prompt List",
    "RandomAIPromptBlock": "🎲 Prompt Block",
    "RandomAIPromptDPL": "🎲 DPL Expand",
    "RandomAIPromptRewrite": "🎲 Prompt Rewrite",
}
