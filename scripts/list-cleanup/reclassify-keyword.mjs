/**
 * @file One-shot: hand-reclassify the keyword leftover tail (keyword-sfw.txt) into
 * proper lists, drop the obvious junk, keep a small remainder. Lossless: every
 * source line must have an explicit decision or the script throws.
 *
 * Run: node scripts/list-cleanup/reclassify-keyword.mjs        (dry run report)
 *      node scripts/list-cleanup/reclassify-keyword.mjs --write (apply)
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..", "..", "data", "lists");
const SRC = "keyword/keyword-sfw";
const WRITE = process.argv.includes("--write");

// token -> destination list. LOWER targets are lowercased on insert (they hold
// common words); the rest keep original (Title-case) casing.
const DEST = {
  ANIM: "nature/animal",
  M: "lore/mythology",
  AS: "lore/astronomy",
  PL: "place/place",
  PER: "name/person",
  GN: "name/given-name",
  ARTMOV: "style/art-movement",
  H: "lore/history",
  R: "lore/religion",
  PEOPLE: "lore/people-group",
  ORG: "brand/organization",
  FLOWER: "nature/flower",
  MYTHC: "nature/mythological-creature",
  HAIR: "look/hair",
  TIME: "look/time",
  CLOTHES: "look/clothes-sfw",
  NOUN: "word/noun",
  ADJ: "word/adjective",
  VERB: "word/verb",
};
const LOWER = new Set(["word/noun", "word/adjective", "word/verb", "look/time", "look/hair", "look/clothes-sfw"]);

// Explicit decision for every entry. DROP = remove, KEEP = stay in keyword.
const MAP = {
  Ac: "DROP", Adar: "R", Admiralty: "NOUN", Afr: "DROP", Afro: "HAIR",
  Afrocentric: "ADJ", Afrocentrism: "NOUN", Ag: "DROP", Al: "DROP", Ala: "DROP",
  Am: "DROP", Americana: "NOUN", Americanism: "NOUN", Americanization: "NOUN", Ameslan: "DROP",
  Anglicism: "NOUN", Anglicization: "NOUN", Anglophile: "NOUN", Anglophobe: "NOUN", Anthropocene: "H",
  Antigone: "M", Anubis: "M", Apatosaurus: "ANIM", Apollonian: "ADJ", Appaloosa: "ANIM",
  Apr: "DROP", Aquarian: "ADJ", Ar: "DROP", Arabist: "NOUN", Ariosto: "PER",
  Aristarchus: "PER", Aristides: "PER", Aristophanes: "PER", Arius: "PER", Armagnac: "NOUN",
  Assembly: "NOUN", At: "DROP", Atalanta: "M", Atlantes: "M", Attn: "DROP",
  Au: "DROP", Audion: "NOUN", Aug: "DROP", Australopithecus: "ANIM", Av: "DROP",
  Ayurveda: "NOUN", Ba: "DROP", Baathist: "NOUN", Babel: "M", Bacchanalia: "M",
  Barents: "PER", Bauhaus: "ARTMOV", BBSes: "DROP", Bearnaise: "NOUN", Beatlemania: "NOUN",
  Belg: "DROP", Berenice: "GN", Bi: "DROP", Bk: "DROP", Blu: "DROP",
  Bollywood: "NOUN", Br: "DROP", Brillouin: "PER", Briticism: "NOUN", Brontosaurus: "ANIM",
  Brownian: "ADJ", Brownie: "MYTHC", Btu: "DROP", Bushido: "NOUN", Byronic: "ADJ",
  Ca: "DROP", Cabernet: "NOUN", Cadette: "DROP", Caligula: "PER", Camembert: "NOUN",
  Canad: "DROP", Canadianism: "NOUN", Capuchin: "ANIM", Cb: "DROP", Ch: "DROP",
  Challenger: "NOUN", Chaplinesque: "ADJ", Charbray: "ANIM", Chardonnay: "NOUN", Charlemagne: "PER",
  Charolais: "ANIM", Chatterley: "PER", Chekhovian: "ADJ", Chi: "DROP", Christi: "DROP",
  Christmastime: "TIME", Cm: "DROP", Col: "DROP", Columbine: "FLOWER", Com: "DROP",
  Commonwealth: "NOUN", Communism: "NOUN", Concorde: "NOUN", Cong: "DROP", Congreve: "PER",
  Constitution: "NOUN", Corp: "DROP", Corvette: "NOUN", Cote: "DROP", Cr: "DROP",
  Cryptozoic: "ADJ", Ct: "DROP", Cu: "DROP", Dada: "ARTMOV", Dadaism: "ARTMOV",
  Dalai: "DROP", Dame: "NOUN", Dangerfield: "DROP", Danubian: "ADJ", Darwinism: "NOUN",
  Darwinist: "NOUN", Deadhead: "NOUN", Death: "NOUN", Debouillet: "ANIM", Dec: "DROP",
  December: "TIME", Del: "DROP", Dem: "DROP", Democrat: "NOUN", Devanagari: "KEEP",
  Devonian: "H", Di: "DROP", Diaspora: "NOUN", Diophantine: "ADJ", Dir: "DROP",
  Dirac: "PER", Dirichlet: "PER", Dixieland: "NOUN", Django: "ORG", Doberman: "ANIM",
  Doe: "ANIM", Dominion: "NOUN", Douay: "DROP", Du: "DROP", Duroc: "ANIM",
  Dy: "DROP", Ebola: "NOUN", Ebonics: "KEEP", Ecstasy: "NOUN", Egyptology: "NOUN",
  Elul: "R", Eng: "DROP", Enos: "GN", Eocene: "H", Er: "DROP",
  Erse: "KEEP", Escherichia: "NOUN", Esperanto: "KEEP", Esquire: "NOUN", Establishment: "NOUN",
  Eur: "DROP", Eurodollar: "NOUN", Eustachian: "ADJ", Excellency: "NOUN", Exchequer: "NOUN",
  Exocet: "NOUN", Eyre: "DROP", Fallopian: "ADJ", Farsi: "KEEP", Faulknerian: "ADJ",
  Fe: "DROP", Feb: "DROP", February: "TIME", Fed: "DROP", Federalist: "NOUN",
  Fido: "DROP", Fm: "DROP", Foosball: "NOUN", Fr: "DROP", Francophile: "NOUN",
  Franglais: "KEEP", Frau: "NOUN", Fraulein: "NOUN", Fri: "DROP", Friday: "TIME",
  Galaxy: "AS", Gallicism: "NOUN", Gamay: "NOUN", Gastroenterology: "NOUN", Gd: "DROP",
  Ge: "DROP", Gelbvieh: "ANIM", Gentoo: "ANIM", Geo: "DROP", Ger: "DROP",
  Gewurztraminer: "NOUN", GHz: "DROP", Gk: "DROP", Godspeed: "NOUN", Gopher: "ANIM",
  Governor: "NOUN", Gr: "DROP", Grammy: "NOUN", Ha: "DROP", Hamiltonian: "ADJ",
  Hangul: "KEEP", Havarti: "NOUN", He: "DROP", Heb: "DROP", Hebraism: "NOUN",
  Helicobacter: "NOUN", Hellenism: "NOUN", Hellenist: "NOUN", Hellenization: "NOUN", Hellenize: "VERB",
  Hench: "ADJ", Herr: "NOUN", Heshvan: "R", Hf: "DROP", Hg: "DROP",
  Highlander: "NOUN", Highness: "NOUN", Ho: "DROP", Holiness: "NOUN", Holocene: "H",
  Hong: "DROP", Hts: "DROP", Hung: "DROP", Hz: "DROP", Ind: "DROP",
  Indra: "M", Indy: "DROP", Internet: "NOUN", Inuit: "PEOPLE", Inuktitut: "KEEP",
  Ionesco: "PER", Ir: "DROP", Iscariot: "PER", Islamism: "NOUN", Islamist: "NOUN",
  Islamophobia: "NOUN", Islamophobic: "ADJ", It: "DROP", Ital: "DROP", Italianate: "ADJ",
  Ivory: "NOUN", Iyar: "R", January: "TIME", Jarlsberg: "NOUN", Jaycee: "DROP",
  Jock: "NOUN", Joycean: "ADJ", Jpn: "DROP", Judaeo: "DROP", Jul: "DROP",
  July: "TIME", Jun: "DROP", Kalb: "DROP", Kannada: "KEEP", Kb: "DROP",
  Keck: "DROP", Kilroy: "NOUN", Kislev: "R", Klansman: "DROP", Knossos: "PL",
  Kohinoor: "NOUN", Kr: "DROP", Krakatoa: "PL", Kremlinologist: "NOUN", Kremlinology: "NOUN",
  Kringle: "NOUN", Krugerrand: "NOUN", Ky: "DROP", La: "DROP", Lab: "DROP",
  Lactobacillus: "NOUN", Lady: "NOUN", Ladyship: "NOUN", Lagrangian: "ADJ", Lambrusco: "NOUN",
  Landsat: "NOUN", Laplacian: "ADJ", Lassa: "NOUN", Lat: "DROP", Lateran: "PL",
  Laundromat: "NOUN", Le: "DROP", Leghorn: "ANIM", Leninism: "NOUN", Leninist: "NOUN",
  Les: "DROP", Liebfraumilch: "NOUN", Lieut: "DROP", Limburger: "NOUN", Lipizzaner: "ANIM",
  Ln: "DROP", Loafer: "CLOTHES", Lockean: "ADJ", Lordship: "NOUN", Lorentzian: "ADJ",
  Los: "DROP", Louvre: "PL", Lr: "DROP", Mac: "DROP", Mace: "NOUN",
  Madam: "NOUN", Mafioso: "NOUN", Mahayanist: "NOUN", Mai: "DROP", Majesty: "NOUN",
  Maker: "NOUN", Malayalam: "KEEP", Mandarin: "KEEP", Maoism: "NOUN", Marxian: "ADJ",
  Marxism: "NOUN", Maypole: "NOUN", Mb: "DROP", McJob: "NOUN", Md: "DROP",
  Me: "DROP", Memcached: "DROP", Merlot: "NOUN", Messieurs: "NOUN", Mex: "DROP",
  Mg: "DROP", Mgr: "DROP", MHz: "DROP", Mich: "DROP", Mideastern: "ADJ",
  Milquetoast: "NOUN", Miltonian: "ADJ", Miltonic: "ADJ", Min: "DROP", Miocene: "H",
  Mir: "NOUN", Missy: "NOUN", Mister: "NOUN", Mistress: "NOUN", Mk: "DROP",
  Mn: "DROP", Mo: "DROP", Moho: "DROP", Moll: "NOUN", Mon: "DROP",
  Monday: "TIME", Monera: "NOUN", Mongolic: "ADJ", Monsieur: "NOUN", Monsignor: "NOUN",
  Mont: "DROP", Montrachet: "NOUN", Mort: "DROP", Mountie: "NOUN", Mouthe: "DROP",
  Mouton: "NOUN", Mozilla: "ORG", Msgr: "DROP", Na: "DROP", Nahuatl: "KEEP",
  Nam: "DROP", Narmada: "PL", Nation: "NOUN", Nautilus: "ANIM", Navy: "NOUN",
  Nb: "DROP", Nd: "DROP", Ne: "DROP", Negritude: "NOUN", Neogene: "H",
  Nesselrode: "NOUN", Nev: "DROP", Ni: "DROP", Nisan: "R", Nobelist: "NOUN",
  Norw: "DROP", Nov: "DROP", November: "TIME", Np: "DROP", Nubia: "PL",
  Obamacare: "NOUN", Occident: "NOUN", Oct: "DROP", October: "TIME", Oedipal: "ADJ",
  Oktoberfest: "NOUN", Oligocene: "H", Olympiad: "NOUN", Onion: "NOUN", Opposition: "NOUN",
  Ordovician: "H", Ore: "DROP", Oreg: "DROP", Orientalism: "NOUN", Os: "DROP",
  OSes: "DROP", Pa: "DROP", Paleocene: "H", Paleogene: "H", Paralympic: "ADJ",
  Parkinsonism: "NOUN", Parliament: "NOUN", Parmesan: "NOUN", Pate: "NOUN", Pb: "DROP",
  Pd: "DROP", Peace: "NOUN", Pekingese: "ANIM", Percheron: "ANIM", Periclean: "ADJ",
  Permian: "H", Pfc: "DROP", Phanerozoic: "H", Pharaoh: "NOUN", Photostatted: "DROP",
  Photostatting: "DROP", Piccadilly: "PL", Pilate: "PER", Pinyin: "KEEP", Pkwy: "DROP",
  Pl: "DROP", Platonism: "NOUN", Platonist: "NOUN", Pleistocene: "H", Pliocene: "H",
  Pm: "DROP", Po: "DROP", Podunk: "NOUN", Pol: "DROP", Polynesia: "PL",
  Pomerania: "PL", Pomeranian: "ANIM", Pompeian: "ADJ", Pr: "DROP", Prakrit: "KEEP",
  Preakness: "NOUN", Precambrian: "H", Pres: "DROP", Pribilof: "PL", Prokofiev: "PER",
  Promethean: "ADJ", Protagoras: "PER", Proudhon: "PER", Proust: "PER", Pt: "DROP",
  Pu: "DROP", Puerto: "DROP", Pushtu: "KEEP", Quixotism: "NOUN", Quranic: "ADJ",
  Rb: "DROP", Re: "DROP", Reaganomics: "NOUN", Realtor: "NOUN", Redshift: "AS",
  Reginae: "DROP", Renascence: "NOUN", Republicanism: "NOUN", Resistance: "NOUN", Rf: "DROP",
  Rh: "DROP", Rhode: "DROP", Riesling: "NOUN", Rigel: "AS", Rn: "DROP",
  Robt: "DROP", Rom: "DROP", Romanesque: "ARTMOV", Romanticism: "ARTMOV", Roquefort: "NOUN",
  Rotarian: "NOUN", Rottweiler: "ANIM", Rte: "DROP", Ru: "DROP", Rwy: "DROP",
  Rx: "DROP", Ry: "DROP", Salyut: "NOUN", San: "DROP", Sanforized: "DROP",
  Sang: "DROP", Sanskrit: "KEEP", Sat: "DROP", Satanist: "NOUN", Saturday: "TIME",
  Sb: "DROP", Sc: "DROP", Schloss: "NOUN", Schnauzer: "ANIM", Scientologist: "NOUN",
  Scorsese: "PER", Se: "DROP", Secretariat: "NOUN", Senate: "NOUN", Sep: "DROP",
  Sept: "DROP", September: "TIME", Shah: "NOUN", Shavuot: "R", Shevat: "R",
  Shorthorn: "ANIM", Shriner: "NOUN", Shylockian: "ADJ", Si: "DROP", Silurian: "H",
  Simmental: "ANIM", Singleton: "NOUN", Sistine: "ADJ", Sivan: "R", Skylab: "NOUN",
  Sm: "DROP", Smokey: "DROP", Sn: "DROP", Soave: "NOUN", Soc: "DROP",
  Sophoclean: "ADJ", SOSes: "DROP", Soyuz: "NOUN", Sp: "DROP", Spanglish: "KEEP",
  Spencerian: "ADJ", Spenglerian: "ADJ", Spenserian: "ADJ", Spinx: "DROP", Spitsbergen: "PL",
  Sprite: "MYTHC", Sputnik: "NOUN", Sq: "DROP", Sta: "DROP", Ste: "DROP",
  Stoicism: "NOUN", Sudoku: "NOUN", Sunday: "TIME", Superbowl: "NOUN", Superfund: "NOUN",
  Swed: "DROP", Switz: "DROP", Syriac: "KEEP", Ta: "DROP", Taliban: "DROP",
  Talmudic: "ADJ", Talmudist: "NOUN", Tb: "DROP", Tc: "DROP", Te: "DROP",
  TELNETTed: "DROP", TELNETTing: "DROP", Tennysonian: "ADJ", Tenochtitlan: "PL", Terr: "DROP",
  Terran: "NOUN", Tet: "NOUN", Tevet: "R", Th: "DROP", Thomistic: "ADJ",
  Thu: "DROP", Thur: "DROP", Thursday: "TIME", Ti: "DROP", Tishri: "R",
  Titian: "PER", Tl: "DROP", Tm: "DROP", Tokay: "NOUN", Torrens: "DROP",
  Tory: "NOUN", Treasury: "NOUN", Trekkie: "NOUN", Truth: "NOUN", Tu: "DROP",
  Tue: "DROP", Tuesday: "TIME", Twp: "DROP", Unionist: "NOUN", Urdu: "KEEP",
  VAXes: "DROP", Venusian: "ADJ", Victorianism: "NOUN", VoIP: "DROP", Voyager: "NOUN",
  Vulg: "DROP", Wac: "DROP", Wednesday: "TIME", WiFi: "DROP", Windbreaker: "CLOTHES",
  Winesap: "NOUN", Wm: "DROP", Workman: "NOUN", Xe: "DROP", Yb: "DROP",
  Yiddish: "KEEP", Yorkie: "ANIM", Ziggy: "DROP", Zika: "NOUN", Zinfandel: "NOUN",
  Zn: "DROP", Zr: "DROP", Zzz: "DROP",
};

const read = (rel) => {
  try {
    return fs.readFileSync(path.join(root, `${rel}.txt`), "utf8").replace(/\r/g, "").split("\n");
  } catch {
    return [];
  }
};
const stripTrailing = (arr) => {
  const a = [...arr];
  while (a.length && a[a.length - 1].trim() === "") a.pop();
  return a;
};

const src = stripTrailing(read(SRC));

// Coverage: every source line must have an explicit decision.
const missing = src.filter((l) => !(l in MAP));
if (missing.length) {
  console.error("UNCLASSIFIED (add to MAP):", missing);
  process.exit(1);
}

const adds = {}; // dest path -> Set
const kept = [];
const dropped = [];
const byToken = {};
for (const line of src) {
  const tok = MAP[line];
  byToken[tok] = (byToken[tok] || 0) + 1;
  if (tok === "DROP") {
    dropped.push(line);
    continue;
  }
  if (tok === "KEEP") {
    kept.push(line);
    continue;
  }
  const dest = DEST[tok];
  const val = LOWER.has(dest) ? line.toLowerCase() : line;
  (adds[dest] ||= new Set()).add(val);
}

// Coverage check
const total = src.length;
const relocated = Object.values(adds).reduce((n, s) => n + s.size, 0);
console.log("source entries:", total);
console.log("by token:", byToken);
console.log("relocated (unique):", relocated, "| kept:", kept.length, "| dropped:", dropped.length);
console.log("kept (remainder):", kept.join(", "));
console.log("\nrelocations:");
for (const [dest, set] of Object.entries(adds).sort()) console.log(`  ${dest}: +${set.size}`);

if (!WRITE) {
  console.log("\n(dry run — pass --write to apply)");
  process.exit(0);
}

// Apply: merge each dest (dedup case-insensitively against existing), sort
// case-insensitively, write back. Then rewrite keyword-sfw with the remainder.
for (const [dest, set] of Object.entries(adds)) {
  const existing = stripTrailing(read(dest));
  const seen = new Set(existing.map((x) => x.toLowerCase()));
  const merged = [...existing];
  for (const v of set) if (!seen.has(v.toLowerCase())) merged.push(v);
  merged.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  fs.writeFileSync(path.join(root, `${dest}.txt`), merged.join("\n") + "\n");
}
fs.writeFileSync(path.join(root, `${SRC}.txt`), stripTrailing(kept).sort().join("\n") + "\n");
console.log("\nWROTE changes.");
