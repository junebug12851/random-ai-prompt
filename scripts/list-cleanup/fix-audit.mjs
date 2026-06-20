/* Copyright 2026 junebug12851 — Apache-2.0.
 * Apply the parallel-audit findings: fix typos in place, remove garbage/fragments,
 * and move misfit entries to the correct list. Relocations preserve content
 * (only true typos/garbage are dropped). All touched files end de-duped + sorted.
 *   node scripts/list-cleanup/fix-audit.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");
const file = (rel) => path.join(listsDir, `${rel}.txt`);
const read = (rel) => {
  try { return fs.readFileSync(file(rel), "utf8").split(/\r?\n/).map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== ""); }
  catch { return []; }
};

// in-memory working copies of every touched file
const buf = {};
const load = (rel) => (buf[rel] ||= read(rel));
const addQueue = {}; // rel -> [lines to append]
const queueAdd = (rel, line) => (addQueue[rel] ||= []).push(line);

// --- 1) typo fixes: rel -> { oldLine: newLine } ---
const TYPO = {
  "nature/animal": { Aardwark: "Aardvark", Cyote: "Coyote", Raindeer: "Reindeer" },
  "nature/flower": { Calebdula: "Calendula", Chiondoxa: "Chionodoxa", Hyaconth: "Hyacinth", Lewesia: "Lewisia" },
  "look/image-effect": { Vingette: "Vignette" },
  "look/view": { "ariel view": "aerial view", birdview: "bird view" },
  "scene/room": { "Linen Coset": "Linen Closet" },
  "scene/store-type": { "Purfume Shop": "Perfume Shop" },
  "style/construct-style": { "Art Nouveaustyle": "Art Nouveau style" },
  "look/clothes": { "grey leota": "grey leotard", "purple ves": "purple vest" },
  "look/instrument": { "Guitars:": "Guitars", "Concert ukulele[3]": "Concert ukulele" },
};

// --- 2) removals: rel -> [garbage/fragment lines] ---
const REMOVE = {
  "nature/animal": ["Aquatic life", "Real Birds"],
  "nature/tree": ["folliage", "pines cones"],
  "look/clothes": ["beltbra", "beltskirt"],
  "look/hair": ["UnderHaircut"],
  "look/instrument": ["Piano pianoforte", "Trumpet marine:tromba marina"],
  "look/action": ["faceing", "gnawling", "poting", "stabling", "stoping", "shuting", "operateing", "2d dating"],
  "look/emotion": ["tears", "mixed up"],
  "brand/organization": ["Co", "Inc", "Ltd", "Eu"],
  "name/given-name": ["Adm","Capt","Cmdr","Comdr","Cpl","Dr","Esq","Gen","Hon","Jr","Lt","Maj","Mlle","Mme","Mr","Ms","PhD","Prof","Pvt","Rep","Sgt","Sir","Sr","Supt"],
};

// --- 3) simple moves: fromRel -> { line: toRel } ---
const MOVE = {
  "look/emotion": { grinning: "look/expression", "tongue out": "look/expression", yawning: "look/action" },
  "look/expression": { "goldfish scooping": "look/action" },
  "look/image-effect": { "Head shot": "look/view" },
  "nature/flower": { "Jacaranda tree": "nature/tree" },
  "lore/mythology": { Sasquatch: "nature/mythological-creature", Thunderbird: "nature/mythological-creature" },
  "look/clothes": { ballet: "look/action", dressing: "look/action" },
  "artist/anime": { "Bakemono Zukushi": "lore/work" },
};

// --- 4) moves with transform (strip culture tag): fromRel -> { line: [toRel, newLine] } ---
const MOVE_T = {
  "nature/mythological-creature": {
    "Agni Hindu": ["lore/mythology", "Agni"], "Geb Egyptian": ["lore/mythology", "Geb"],
    "Hades Greek": ["lore/mythology", "Hades"], "Neptune Roman": ["lore/mythology", "Neptune"],
    "Odin Norse": ["lore/mythology", "Odin"], "Thor Norse": ["lore/mythology", "Thor"],
    "Zeus Greek": ["lore/mythology", "Zeus"], "Loki Norse": ["lore/mythology", "Loki"],
    "Aesir Norse": ["lore/mythology", "Aesir"], "Quetzalcoatl Aztec": ["lore/mythology", "Quetzalcoatl"],
    "Venus Lovecraftian": ["lore/mythology", "Venus"], "Satan Heaven-Abrahamic": ["lore/mythology", "Satan"],
  },
};

// fictional names out of given-name -> lore/work
const givenToWork = ["Cthulhu", "Superman"];
// surnames / famous people out of given-name -> name/person
const givenToPerson = ["Alvarez","Andersen","Ayala","Baez","Baryshnikov","Bauer","Beck","Beethoven","Browne","Bunsen","Calderon","Cardozo","Caruso","Castro","Chan","Chang","Chaucer","Chavez","Chen","Chernenko","Chopin","Chopra","Christensen","Chung","Clarke","Clemens","Cohen","Confucius","Contreras","Cooke","Cruz","Delgado","Dias","Dominguez","Dvorak","Einstein","Eminem","Espinoza","Estrada","Fernandez","Ferrari","Flores","Friedman","Fuchs","Fuentes","Fuller","Gallo","Gandhi","Garza","Goldberg","Gomez","Gorbachev","Guerrero","Gutierrez","Guzman","Herrera","Hess","Hitler","Huang","Huber","Ito","Jimenez","Jung","Kalashnikov","Keats","Khan","Klein","Koch","Lang","Lenin","Liberace","Lombardi","Lowe","Lysenko","MacDonald","Madonna","Malinowski","Mancini","Mann","Markov","McCarthy","McDonald","McDonnell","McDowell","McLaughlin","Meier","Mejia","Mendez","Messiaen","Meyer","Milosevic","Moliere","Monet","Moreno","Morin","Mozart","Mulder","Muller","Munoz","Mussolini","Myers","Nagy","Nansen","Nguyen","Nielsen","Nostradamus","Obama","Olsen","Olson","Ortega","Ortiz","Patel","Pavlov","Pele","Pena","Perez","Petersen","Picasso","Poe","Poisson","Putin","Rachmaninoff","Ramirez","Ramos","Reyes","Rodriguez","Rojas","Romano","Romanov","Rostropovich","Roth","Rothko","Rowling","Ruiz","Rubin","Russo","Saarinen","Salas","Santana","Saunders","Schmidt","Schubert","Schulz","Seinfeld","Serrano","Shakespeare","Simmons","Sinatra","Singh","Socrates","Soto","Sousa","Stalin","Steiner","Suarez","Suzuki","Torres","Tran","Tyson","Ustinov","Valenzuela","Vargas","Vasquez","Vazquez","Velasquez","Vivaldi","Warhol","Weber","Weiss","Wolff","Wong","Xenakis","Yevtushenko","Zhdanov","Zyuganov","Evita"];
for (const n of givenToWork) (MOVE["name/given-name"] ||= {})[n] = "lore/work";
for (const n of givenToPerson) (MOVE["name/given-name"] ||= {})[n] = "name/person";
// bare first names out of person -> given-name
const personToGiven = ["April","Autumn","Aldo","Bella","Beau","Berta","Brandy","Clem","Clementine","Concetta","Dino","Dollie","Dolly","Fern","Flo","Gene","Ginny","Jan","Jasmine","June","Kitty","Lizzy","Melody","Nan","Penny","Robin","Sonny","Zeke"];
for (const n of personToGiven) (MOVE["name/person"] ||= {})[n] = "name/given-name";

// collect every source file we touch
const sources = new Set([...Object.keys(TYPO), ...Object.keys(REMOVE), ...Object.keys(MOVE), ...Object.keys(MOVE_T)]);
const stats = { typo: 0, removed: 0, moved: 0 };

for (const rel of sources) {
  const lines = load(rel);
  const typo = TYPO[rel] || {};
  const rm = new Set(REMOVE[rel] || []);
  const mv = MOVE[rel] || {};
  const mvt = MOVE_T[rel] || {};
  const kept = [];
  for (const line of lines) {
    if (rm.has(line)) { stats.removed++; continue; }
    if (mvt[line]) { const [to, nl] = mvt[line]; queueAdd(to, nl); stats.moved++; continue; }
    if (mv[line]) { queueAdd(mv[line], line); stats.moved++; continue; }
    if (typo[line]) { kept.push(typo[line]); stats.typo++; continue; }
    kept.push(line);
  }
  buf[rel] = kept;
}

// apply queued additions
for (const [rel, adds] of Object.entries(addQueue)) {
  const cur = new Set(load(rel));
  for (const a of adds) cur.add(a);
  buf[rel] = [...cur];
}

// write every touched file, de-duped + sorted
for (const rel of Object.keys(buf)) {
  const uniq = Array.from(new Set(buf[rel].filter((l) => l.trim() !== ""))).sort((a, b) => a.localeCompare(b));
  fs.writeFileSync(file(rel), uniq.join("\n") + "\n");
}

console.log(`typos fixed ${stats.typo}, removed ${stats.removed}, moved ${stats.moved}`);
console.log(`files written: ${Object.keys(buf).length}`);
