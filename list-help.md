Keyword lists
============================
Each `.txt` in `data/lists/` is one keyword per line. Reference a list in a prompt
with `{name}`. Some names are **virtual lists** (no file on disk) — composites
assembled on demand from other lists (see "Virtual lists" below and
`src/listManifest.js`). Adult/extreme content is filtered by `src/contentSafety.js`
and gated behind the `includeAdult` setting; see `notes/reference/list-architecture.md`.

Parts of speech
============================
adjective.txt       Curated, hand-picked evocative adjectives
adverb.txt          Curated adverbs
noun.txt            Curated nouns
verb.txt            Curated verbs
preposition.txt     Prepositions
interjection.txt    Interjections
dict-adjective.txt  Adjectives sorted from the English dictionary (keyword.txt)
dict-noun.txt       Nouns sorted from the dictionary
dict-verb.txt       Verbs sorted from the dictionary
dict-adverb.txt     Adverbs sorted from the dictionary
dict-misc.txt       Function words / numbers / interjections the sorter couldn't bucket
adjective-all       (virtual) adjective.txt + dict-adjective.txt
noun-all            (virtual) noun.txt + dict-noun.txt
verb-all            (virtual) verb.txt + dict-verb.txt
adverb-all          (virtual) adverb.txt + dict-adverb.txt

Proper nouns & subjects
============================
keyword.txt         Proper nouns — people, places, brands (was the dictionary dump)
demonym.txt         Nationality / demonym words (American, Japanese, ...)
city.txt            City / place names
anime-name.txt      Anime titles / character names
animal.txt, flower.txt, tree.txt, mythological-creature.txt, planet.txt, ...

Standard Artists (AUTOMATIC1111)
============================
artist-anime.txt    Anime artists
artist-bw.txt       Black and white artists
artist-cartoon.txt  Cartoon artists
artist-dhigh.txt    Digipa high-impact artists
artist-dmed.txt     Digipa medium-impact artists
artist-dlow.txt     Digipa low-impact artists
artist-fareast.txt  Far East artists
artist-fineart.txt  Fine-art artists
artist-nudity.txt   Nudity artists (NSFW-gated)
artist-scribbles.txt, artist-special.txt, artist-ukioe.txt, artist-weird.txt
artist2.txt         Secondary artist list
artist-digipa       (virtual) artist-dhigh + artist-dmed + artist-dlow
artist              (virtual) union of all artist-* category lists

Danbooru tags
============================
d-general.txt       General danbooru tags (anime; NSFW-gated)
d-artist.txt        Danbooru artists
d-character-c.txt   Copyright (branded) characters
d-character-nc.txt  Non-copyright characters
d-meta.txt          Meta tags (effects, etc.)
d-person.txt        Person tags
d-character          (virtual) d-character-nc + d-character-c
d-keyword            (virtual) d-general + d-character-c + d-character-nc + d-meta (NSFW-gated)
danbooru             (virtual) all of the above, incl. d-artist (NSFW-gated)
danbooru-sfw         (virtual) danbooru with NSFW-lexicon lines filtered out — the clean anime list

Keywords
============================
keyword-adult.txt   Adult keywords (NSFW-gated)

Misc lists
============================
color, clothes, hair, emotion, mood, weather, time, size, view, room, building-style,
art-movement, art-technique, general-style, image-effect, instrument, vehicle-type,
ship-type, store-type, shed-type, school-room, construct-style

Virtual lists
============================
A virtual list is defined in `src/listManifest.js` as a union of other lists, with
cross-list de-duplication and an optional sfw/nsfw filter. They let lists "collapse
into" one another (so big duplicate files don't sit on disk) and let curated lists
combine with the dictionary lists. Reference them by name like any other list.

Content safety
============================
`src/contentSafety.js` holds the removal blocklist (slurs, content sexualizing minors,
extreme shock/gore/non-consensual) and the NSFW lexicon (ordinary adult terms, kept but
gated). It is applied by the CSV build scripts and the one-time cleanup tooling in
`scripts/list-cleanup/`. The blocklist is plain, editable data — add or remove terms there.
