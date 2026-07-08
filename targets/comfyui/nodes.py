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

The app's URL is configured once, in **Settings → "Random AI Prompt — app URL"** (or the
``RANDOM_AI_PROMPT_URL`` env var), not per-node — so the nodes stay uncluttered, the Comfy way.
"""

from __future__ import annotations

from . import client

CATEGORY = "Random AI Prompt"
_SEED = ("INT", {"default": 0, "min": 0, "max": 0xFFFFFFFFFFFFFFFF, "control_after_generate": True})


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
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "generate"
    CATEGORY = CATEGORY

    def generate(self, template, seed, nsfw, preset):
        result = client.generate(
            template=template, seed=seed, preset=preset, settings={"includeAdult": bool(nsfw)}
        )
        return (_first(result),)

    @classmethod
    def IS_CHANGED(cls, template, seed, nsfw, preset):
        return f"{template}|{seed}|{nsfw}|{preset}"


class RandomAIPromptList:
    """Helper: draw one random entry from a named word list (``{list}``)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"list_name": (client._names("lists"),), "seed": _SEED}}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    CATEGORY = CATEGORY

    def run(self, list_name, seed):
        return (_first(client.generate(template="{" + list_name + "}", seed=seed)),)

    @classmethod
    def IS_CHANGED(cls, list_name, seed):
        return f"{list_name}|{seed}"


class RandomAIPromptBlock:
    """Helper: run one block generator (``{#block}``) — a scene / subject / style fragment."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"block_name": (client._names("blocks"),), "seed": _SEED}}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    CATEGORY = CATEGORY

    def run(self, block_name, seed):
        return (_first(client.generate(template="{#" + block_name + "}", seed=seed)),)

    @classmethod
    def IS_CHANGED(cls, block_name, seed):
        return f"{block_name}|{seed}"


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
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    CATEGORY = CATEGORY

    def run(self, template, seed, nsfw):
        result = client.generate(template=template, seed=seed, settings={"includeAdult": bool(nsfw)})
        return (_first(result),)

    @classmethod
    def IS_CHANGED(cls, template, seed, nsfw):
        return f"{template}|{seed}|{nsfw}"


NODE_CLASS_MAPPINGS = {
    "RandomAIPromptGenerator": RandomAIPromptGenerator,
    "RandomAIPromptList": RandomAIPromptList,
    "RandomAIPromptBlock": RandomAIPromptBlock,
    "RandomAIPromptDPL": RandomAIPromptDPL,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RandomAIPromptGenerator": "Random AI Prompt",
    "RandomAIPromptList": "Prompt List",
    "RandomAIPromptBlock": "Prompt Block",
    "RandomAIPromptDPL": "DPL Expand",
}
