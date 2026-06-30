/**
 * @file react-intl messages for the Manage list editor (status lines, AI-expand prompts, tab/action
 * labels). Split out of ManageListEditor.jsx, which keeps the component + the editor behavior.
 * @module gui/lib/manage/listEditorMessages
 */
import { defineMessages } from "react-intl";

export const msgs = defineMessages({
  removedDupes: {
    id: "listEd.removedDupes",
    defaultMessage: "Removed {count, plural, one {# duplicate} other {# duplicates}}.",
  },
  noDupes: { id: "listEd.noDupes", defaultMessage: "No duplicates found." },
  sortedAZ: { id: "listEd.sortedAZ", defaultMessage: "Sorted A–Z." },
  pickProvider: {
    id: "listEd.pickProvider",
    defaultMessage: "Pick a text (AI) provider first — Home → gear → Auto-fix.",
  },
  noKey: {
    id: "listEd.noKey",
    defaultMessage: "No API key for {provider} — add it under Home → gear → Auto-fix.",
  },
  addEntriesFirst: {
    id: "listEd.addEntriesFirst",
    defaultMessage: "Add a few entries first so the AI has something to learn from.",
  },
  onlyDupes: {
    id: "listEd.onlyDupes",
    defaultMessage: "The AI returned only entries you already have — try again.",
  },
  addedStatus: {
    id: "listEd.addedStatus",
    defaultMessage:
      "Added {count, plural, one {# new entry} other {# new entries}}{dropped}. Review, then Save.",
  },
  droppedClause: {
    id: "listEd.droppedClause",
    defaultMessage: " ({count, plural, one {# duplicate} other {# duplicates}} dropped)",
  },
  expandFailed: { id: "listEd.expandFailed", defaultMessage: "AI expand failed: {error}" },
  saved: { id: "listEd.saved", defaultMessage: "Saved." },
  renamed: { id: "listEd.renamed", defaultMessage: "Renamed." },
  restoreConfirm: {
    id: "listEd.restoreConfirm",
    defaultMessage: "Restore {name} to the default from the repo? This overwrites your local copy.",
  },
  restored: { id: "listEd.restored", defaultMessage: "Restored from default." },
  loading: { id: "listEd.loading", defaultMessage: "Loading…" },
  clickToEdit: { id: "listEd.clickToEdit", defaultMessage: "Click to edit" },
  empty: { id: "listEd.empty", defaultMessage: "(empty)" },
  deleteEntryAria: { id: "listEd.deleteEntryAria", defaultMessage: "Delete entry" },
  deleteTitle: { id: "listEd.deleteTitle", defaultMessage: "Delete" },
  listName: { id: "listEd.listName", defaultMessage: "List name" },
  rename: { id: "listEd.rename", defaultMessage: "Rename" },
  tabEntries: { id: "listEd.tabEntries", defaultMessage: "Entries" },
  tabRaw: { id: "listEd.tabRaw", defaultMessage: "Raw" },
  saving: { id: "listEd.saving", defaultMessage: "Saving…" },
  save: { id: "listEd.save", defaultMessage: "Save" },
  description: { id: "listEd.description", defaultMessage: "Description" },
  descriptionPh: { id: "listEd.descriptionPh", defaultMessage: "List tooltip" },
  searchPh: { id: "listEd.searchPh", defaultMessage: "Search {count, number} entries…" },
  addEntry: { id: "listEd.addEntry", defaultMessage: "+ Add entry" },
  sortTitle: { id: "listEd.sortTitle", defaultMessage: "Sort entries A–Z" },
  sort: { id: "listEd.sort", defaultMessage: "Sort" },
  dedupeTitle: { id: "listEd.dedupeTitle", defaultMessage: "Remove duplicate entries" },
  dedupe: { id: "listEd.dedupe", defaultMessage: "Dedupe" },
  aiExpandTitle: {
    id: "listEd.aiExpandTitle",
    defaultMessage: "Use AI to add 25 new unique entries in the same style",
  },
  expanding: { id: "listEd.expanding", defaultMessage: "Expanding…" },
  aiExpand: { id: "listEd.aiExpand", defaultMessage: "AI Expand" },
  countMatch: { id: "listEd.countMatch", defaultMessage: "{count, number} match" },
  countEntries: { id: "listEd.countEntries", defaultMessage: "{count, number} entries" },
  rawAria: { id: "listEd.rawAria", defaultMessage: "Raw list text" },
  restoreTitle: {
    id: "listEd.restoreTitle",
    defaultMessage: "Fetch the default from the repo (master)",
  },
  restoreDefault: { id: "listEd.restoreDefault", defaultMessage: "Restore default" },
});
