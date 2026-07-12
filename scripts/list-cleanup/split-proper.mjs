/* Copyright 2026 1fairyfox — Apache-2.0. Analyze (and optionally apply) a sub-split of keyword.txt.
 * Run `node split-proper.mjs`        -> analyze only (read-only), prints distribution + samples.
 * Run `node split-proper.mjs --apply` -> writes the split lists and shrinks keyword.txt.
 * Never deletes a word — everything lands in some list (leftover stays in keyword.txt).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nlp from "compromise";

const apply = process.argv.includes("--apply");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");
const read = (n) => {
  try {
    return fs
      .readFileSync(path.join(listsDir, `${n}.txt`), "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};
const citySet = new Set(read("city").map((w) => w.toLowerCase()));

// confirmedCity = already in city.txt (authoritative dedupe). place = compromise guess.
const buckets = {
  confirmedCity: [],
  place: [],
  org: [],
  "given-name": [],
  surname: [],
  leftover: [],
};
for (const w of read("keyword")) {
  const lc = w.toLowerCase();
  const doc = nlp(w);
  if (citySet.has(lc)) buckets.confirmedCity.push(w);
  else if (doc.has("#Place") || doc.has("#City") || doc.has("#Country") || doc.has("#Region"))
    buckets.place.push(w);
  else if (doc.has("#Organization")) buckets.org.push(w);
  else if (doc.has("#FirstName") || doc.has("#Person")) buckets["given-name"].push(w);
  else if (doc.has("#LastName")) buckets.surname.push(w);
  else buckets.leftover.push(w);
}

for (const [k, v] of Object.entries(buckets)) {
  console.log(`${k}: ${v.length}`);
  console.log("   e.g.", v.slice(0, 14).join(", "));
}

if (apply) {
  const writeNew = (n, arr) =>
    fs.writeFileSync(
      path.join(listsDir, `${n}.txt`),
      Array.from(new Set(arr))
        .sort((a, b) => a.localeCompare(b))
        .join("\n") + "\n",
    );
  // confirmedCity entries already live in city.txt -> just drop them from keyword (no pollution).
  writeNew("given-name", buckets["given-name"]);
  writeNew("surname", buckets.surname);
  writeNew("organization", buckets.org);
  writeNew("place", buckets.place);
  // keyword.txt keeps only the uncategorized tail.
  writeNew("keyword", buckets.leftover);
  console.log(
    "\nAPPLIED. keyword.txt now:",
    new Set(buckets.leftover).size,
    "| given-name",
    new Set(buckets["given-name"]).size,
    "| surname",
    new Set(buckets.surname).size,
    "| place",
    new Set(buckets.place).size,
    "| organization",
    new Set(buckets.org).size,
    "| confirmed cities dropped (already in city.txt):",
    new Set(buckets.confirmedCity).size,
  );
}
