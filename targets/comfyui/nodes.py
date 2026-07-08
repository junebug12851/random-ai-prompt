"""
Random AI Prompt — ComfyUI nodes.

Prompt-side only: ComfyUI already owns image generation, upscaling, variations, and re-roll (its native
seed widget). These nodes bring the *prompt* engine — the DPL processor, blocks, lists, and presets —
into the graph as natural-language-first STRING sources you feed into a CLIP Text Encode.

Every node is a thin wrapper: the real work happens in the shared engine behind the running app's
backend (see ``client.py``). The flagship ``RandomAIPromptGenerator`` does ~90% of the work; the rest
are small helpers (grouped under the "Random AI Prompt/helpers" menu).

The ``seed`` widget carries ComfyUI's native ``control_after_generate`` — set it to *randomize* to
re-roll a fresh prompt each run, or *fixed* to reproduce one. Same inputs → same prompt (cached).

The app's URL is configured once, in **Settings → "Random AI Prompt — app URL"** (or the
``RANDOM_AI_PROMPT_URL`` env var), not per-node — so the nodes stay uncluttered, the Comfy way.
"""

from __future__ import annotations

from . import client

CATEGORY = "Random AI Prompt"
HELPERS = "Random AI Prompt/helpers"

_SEED_TOOLTIP = (
    "Re-roll control. Set the control below to 'randomize' for a fresh prompt each run, or 'fixed' to "
    "reproduce one. The same seed + inputs always give the same prompt."
)
_SEED = (
    "INT",
    {
        "default": 0,
        "min": 0,
        "max": 0xFFFFFFFFFFFFFFFF,
        "control_after_generate": True,
        "tooltip": _SEED_TOOLTIP,
    },
)
_NSFW = ("BOOLEAN", {"default": False, "tooltip": "Allow adult / NSFW content (off by default)."})


def _first(result: dict) -> str:
    prompts = result.get("prompts") or []
    return prompts[0] if prompts else ""


class RandomAIPromptGenerator:
    """The flagship node: a natural-language / DPL template in, a rich generated prompt out."""

    DESCRIPTION = (
        "Generate a rich image prompt from a natural-language or DPL template. Leave the template "
        "blank for a fully random prompt, or mix in {#block} and {list} tokens for controlled "
        "randomness. Wire the output into a CLIP Text Encode."
    )

    @classmethod
    def INPUT_TYPES(cls):
        presets = ["none", *(client.catalog().get("presets") or [])]
        return {
            "required": {
                "template": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "",
                        "placeholder": "Leave blank for a fully random prompt, or type DPL, e.g. "
                        "a photo of {#subject}, {#style}, {#lighting}",
                        "tooltip": "Your prompt. Plain English works; blank = fully random. DPL tokens "
                        "give controlled randomness: {#subject}, {#style}, {list}, {#any}, weighted "
                        "choices, etc.",
                    },
                ),
                "seed": _SEED,
                "nsfw": _NSFW,
                "preset": (
                    presets,
                    {"tooltip": "Apply a saved preset's settings before generating. 'none' = no preset."},
                ),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    OUTPUT_TOOLTIPS = ("The generated prompt — wire into a CLIP Text Encode.",)
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

    DESCRIPTION = "Draw one random entry from a named word list. Handy to pipe one word into a prompt."

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "list_name": (
                    client._names("lists"),
                    {"tooltip": "Which word list to draw from (loaded live from the app)."},
                ),
                "seed": _SEED,
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    OUTPUT_TOOLTIPS = ("One random entry from the chosen list.",)
    FUNCTION = "run"
    CATEGORY = HELPERS

    def run(self, list_name, seed):
        return (_first(client.generate(template="{" + list_name + "}", seed=seed)),)

    @classmethod
    def IS_CHANGED(cls, list_name, seed):
        return f"{list_name}|{seed}"


class RandomAIPromptBlock:
    """Helper: run one block generator (``{#block}``) — a scene / subject / style fragment."""

    DESCRIPTION = "Run one block generator ({#block}) — a scene / subject / style fragment."

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "block_name": (
                    client._names("blocks"),
                    {"tooltip": "Which block generator to run (loaded live from the app)."},
                ),
                "seed": _SEED,
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    OUTPUT_TOOLTIPS = ("The expanded block text.",)
    FUNCTION = "run"
    CATEGORY = HELPERS

    def run(self, block_name, seed):
        return (_first(client.generate(template="{#" + block_name + "}", seed=seed)),)

    @classmethod
    def IS_CHANGED(cls, block_name, seed):
        return f"{block_name}|{seed}"


class RandomAIPromptDPL:
    """Helper (power users): expand any raw DPL template — the DPL processor, unadorned."""

    DESCRIPTION = (
        "Expand any raw DPL template — the DPL processor, unadorned. For writing DPL directly: tokens "
        "({#block}, {list}, {#any}), weighted choices, conditionals, and more."
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "template": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "{#any}",
                        "tooltip": "Raw DPL, e.g. {#any}, {#subject}, {list}, or weighted choices.",
                    },
                ),
                "seed": _SEED,
                "nsfw": _NSFW,
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    OUTPUT_TOOLTIPS = ("The expanded text.",)
    FUNCTION = "run"
    CATEGORY = HELPERS

    def run(self, template, seed, nsfw):
        result = client.generate(template=template, seed=seed, settings={"includeAdult": bool(nsfw)})
        return (_first(result),)

    @classmethod
    def IS_CHANGED(cls, template, seed, nsfw):
        return f"{template}|{seed}|{nsfw}"


class RandomAIPromptBatch:
    """Generate several prompt variations at once, as a list — for fanning out into multiple images."""

    DESCRIPTION = (
        "Generate N prompt variations from one template and output them as a LIST — feed it downstream "
        "to fan out into multiple images. A pinned seed reproduces the whole batch."
    )

    @classmethod
    def INPUT_TYPES(cls):
        presets = ["none", *(client.catalog().get("presets") or [])]
        return {
            "required": {
                "template": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "",
                        "placeholder": "Leave blank for fully random variations, or type DPL.",
                        "tooltip": "The template each variation expands from. Blank = fully random.",
                    },
                ),
                "count": (
                    "INT",
                    {"default": 4, "min": 1, "max": 64, "tooltip": "How many variations to generate."},
                ),
                "seed": _SEED,
                "nsfw": _NSFW,
                "preset": (
                    presets,
                    {"tooltip": "Apply a saved preset's settings before generating. 'none' = no preset."},
                ),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompts",)
    OUTPUT_IS_LIST = (True,)
    OUTPUT_TOOLTIPS = ("The list of generated prompt variations.",)
    FUNCTION = "run"
    CATEGORY = HELPERS

    def run(self, template, count, seed, nsfw, preset):
        result = client.generate(
            template=template,
            seed=seed,
            count=count,
            preset=preset,
            settings={"includeAdult": bool(nsfw)},
        )
        return (result.get("prompts") or [],)

    @classmethod
    def IS_CHANGED(cls, template, count, seed, nsfw, preset):
        return f"{template}|{count}|{seed}|{nsfw}|{preset}"


class RandomAIPromptCombine:
    """Helper: join several prompt pieces into one string (skips empties) — manual piping of parts."""

    DESCRIPTION = (
        "Join several prompt pieces into one string, separated by `separator`, skipping empties. Wire "
        "Prompt List / Block / Generator outputs into the slots to build a prompt by hand."
    )

    @staticmethod
    def _slot():
        return ("STRING", {"forceInput": True, "tooltip": "A prompt piece to include (empties skipped)."})

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "separator": (
                    "STRING",
                    {"default": ", ", "tooltip": "Placed between the pieces. Default is a comma-space."},
                ),
                "text_1": cls._slot(),
                "text_2": cls._slot(),
            },
            "optional": {"text_3": cls._slot(), "text_4": cls._slot()},
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    OUTPUT_TOOLTIPS = ("The combined prompt.",)
    FUNCTION = "run"
    CATEGORY = HELPERS

    def run(self, separator, text_1="", text_2="", text_3="", text_4=""):
        parts = [str(p) for p in (text_1, text_2, text_3, text_4) if p and str(p).strip()]
        return (str(separator).join(parts),)


class RandomAIPromptShow:
    """Helper: display a prompt string on the node (and pass it through for further chaining)."""

    DESCRIPTION = (
        "Show a prompt string right on the node — handy to see what the engine produced. Passes the "
        "text through unchanged so you can keep chaining it."
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"text": ("STRING", {"forceInput": True, "tooltip": "The prompt to display."})}}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    OUTPUT_TOOLTIPS = ("The same text, passed through.",)
    FUNCTION = "run"
    OUTPUT_NODE = True
    CATEGORY = HELPERS

    def run(self, text):
        return {"ui": {"text": [text]}, "result": (text,)}


NODE_CLASS_MAPPINGS = {
    "RandomAIPromptGenerator": RandomAIPromptGenerator,
    "RandomAIPromptList": RandomAIPromptList,
    "RandomAIPromptBlock": RandomAIPromptBlock,
    "RandomAIPromptDPL": RandomAIPromptDPL,
    "RandomAIPromptBatch": RandomAIPromptBatch,
    "RandomAIPromptCombine": RandomAIPromptCombine,
    "RandomAIPromptShow": RandomAIPromptShow,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RandomAIPromptGenerator": "Random AI Prompt",
    "RandomAIPromptList": "Prompt List",
    "RandomAIPromptBlock": "Prompt Block",
    "RandomAIPromptDPL": "DPL Expand",
    "RandomAIPromptBatch": "Prompt Batch",
    "RandomAIPromptCombine": "Combine Prompts",
    "RandomAIPromptShow": "Show Prompt",
}
