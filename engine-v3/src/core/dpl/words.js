/**
 * @file
 * @brief DPL intensity/focus natural-language word scales — the `$intensity-word` and
 * `$focus-word` tokens. One curated word per percent (1..100). See
 * notes/reference/intensity-design.md and notes/reference/focus-design.md.
 */

// A 100-step intensity word scale: one word per percent, least → most, with 50 ≈ "normal". Curated
// to size / amount / scale / proportion terms (kept the intentional "tiny" run). `$intensity-word`
// at intensity N renders INTENSITY_WORDS[N-1].
export const INTENSITY_WORDS = [
  "barely-there", // 1
  "near-zero", // 2
  "negligible", // 3
  "trace", // 4
  "speck", // 5
  "fleck", // 6
  "smidge", // 7
  "pinch", // 8
  "dab", // 9
  "sliver", // 10
  "scrap", // 11
  "crumb", // 12
  "morsel", // 13
  "drop", // 14
  "sprinkle", // 15
  "spoonful", // 16
  "handful", // 17
  "palmful", // 18
  "pocketful", // 19
  "ultra-tiny", // 20
  "extra-tiny", // 21
  "very tiny", // 22
  "tiny", // 23
  "teensy", // 24
  "itty-bitty", // 25
  "minuscule", // 26
  "miniature", // 27
  "mini", // 28
  "diminutive", // 29
  "little", // 30
  "small", // 31
  "compact", // 32
  "undersized", // 33
  "pint-sized", // 34
  "scant", // 35
  "sparse", // 36
  "meager", // 37
  "skimpy", // 38
  "slight", // 39
  "thin", // 40
  "slim", // 41
  "narrow", // 42
  "short", // 43
  "reduced", // 44
  "partial", // 45
  "modest", // 46
  "moderate", // 47
  "medium", // 48
  "average", // 49
  "normal", // 50
  "full-size", // 51
  "regular", // 52
  "standard", // 53
  "noticeable", // 54
  "decent", // 55
  "respectable", // 56
  "sizable", // 57
  "ample", // 58
  "roomy", // 59
  "generous", // 60
  "broad", // 61
  "wide", // 62
  "large", // 63
  "big", // 64
  "hefty", // 65
  "bulky", // 66
  "oversized", // 67
  "substantial", // 68
  "considerable", // 69
  "abundant", // 70
  "plentiful", // 71
  "copious", // 72
  "overflowing", // 73
  "packed", // 74
  "crowded", // 75
  "expansive", // 76
  "extensive", // 77
  "sweeping", // 78
  "great", // 79
  "major", // 80
  "giant", // 81
  "jumbo", // 82
  "huge", // 83
  "enormous", // 84
  "immense", // 85
  "massive", // 86
  "gigantic", // 87
  "tremendous", // 88
  "colossal", // 89
  "mammoth", // 90
  "titanic", // 91
  "monumental", // 92
  "vast", // 93
  "towering", // 94
  "gargantuan", // 95
  "humongous", // 96
  "mega", // 97
  "immeasurable", // 98
  "limitless", // 99
  "beyond measure", // 100
];

/** The natural-language word for an intensity percent 1..100 (the `$intensity-word` token). */
export function intensityWord(p) {
  const i = Math.min(100, Math.max(1, Math.round(p)));
  return INTENSITY_WORDS[i - 1];
}

// A 100-step focus word scale: one word per percent on the RELEVANCE axis — how much non-topic detail
// is allowed. 1 = anything loosely touching the topic may appear; 50 ≈ normal on-topic; 100 = only the
// exact subject, nothing else. `$focus-word` at focus N renders FOCUS_WORDS[N-1].
export const FOCUS_WORDS = [
  "anything-goes", // 1
  "unbounded", // 2
  "unrestricted", // 3
  "unlimited", // 4
  "freeform", // 5
  "open-ended", // 6
  "loose", // 7
  "lax", // 8
  "permissive", // 9
  "lenient", // 10
  "relaxed", // 11
  "forgiving", // 12
  "tolerant", // 13
  "generous", // 14
  "allowing", // 15
  "broad", // 16
  "general", // 17
  "wide-scope", // 18
  "full-range", // 19
  "far-reaching", // 20
  "low-filter", // 21
  "high-leeway", // 22
  "loose-fit", // 23
  "low-precision", // 24
  "low-adherence", // 25
  "indirect", // 26
  "remote", // 27
  "distant", // 28
  "faintly-related", // 29
  "vaguely-related", // 30
  "loosely-related", // 31
  "side-detail", // 32
  "background-detail", // 33
  "outer-detail", // 34
  "extra-detail", // 35
  "fringe-detail", // 36
  "edge-detail", // 37
  "nearby-detail", // 38
  "related-detail", // 39
  "peripheral", // 40
  "tangential", // 41
  "adjacent", // 42
  "connected", // 43
  "related", // 44
  "relevant", // 45
  "applicable", // 46
  "suitable", // 47
  "balanced", // 48
  "moderate", // 49
  "normal", // 50
  "appropriate", // 51
  "pertinent", // 52
  "germane", // 53
  "on-subject", // 54
  "on-topic", // 55
  "in-scope", // 56
  "within-bounds", // 57
  "subject-bound", // 58
  "topic-bound", // 59
  "bounded", // 60
  "contained", // 61
  "limited", // 62
  "restricted", // 63
  "constrained", // 64
  "filtered", // 65
  "selective", // 66
  "relevant-only", // 67
  "topic-centered", // 68
  "subject-centered", // 69
  "direct", // 70
  "specific", // 71
  "particular", // 72
  "defined", // 73
  "explicit", // 74
  "literal", // 75
  "close-fit", // 76
  "tight-fit", // 77
  "narrow", // 78
  "exact", // 79
  "accurate", // 80
  "precise", // 81
  "clean", // 82
  "uncluttered", // 83
  "spare", // 84
  "minimal", // 85
  "trimmed", // 86
  "pared-down", // 87
  "bare", // 88
  "strict", // 89
  "rigorous", // 90
  "stringent", // 91
  "restrictive", // 92
  "exacting", // 93
  "exclusive", // 94
  "isolated", // 95
  "singular", // 96
  "single-subject", // 97
  "pure", // 98
  "absolute", // 99
  "topic-only", // 100
];

/** The natural-language word for a focus percent 1..100 (the `$focus-word` token); loose → topic-only. */
export function focusWord(p) {
  const i = Math.min(100, Math.max(1, Math.round(p)));
  return FOCUS_WORDS[i - 1];
}
