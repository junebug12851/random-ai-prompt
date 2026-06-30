/**
 * The Home left pane: the building-block palette. A search box, the Blocks/Lists groups with
 * their folder sub-tabs, and the chip cloud. Self-contained — it owns its own search query and
 * active-group/sub-tab state and rebuilds its catalog (it's the only consumer). It reports up
 * only the cross-pane actions: inserting a token into the composer and the hover tooltip.
 * @module gui/components/home/BlockPalette
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { getBlocks, subscribeCatalog } from "../../lib/promptEngine.js";
import { foldersOf } from "../../lib/home/blockCategories.js";

const msgs = defineMessages({
  buildingBlocks: { id: "home.buildingBlocks", defaultMessage: "Building blocks" },
  searchBlocks: { id: "home.searchBlocks", defaultMessage: "Search blocks…" },
  noBlocks: { id: "home.noBlocks", defaultMessage: "No building blocks match “{query}”." },
  all: { id: "home.all", defaultMessage: "all" },
  moreFilter: {
    id: "home.moreFilter",
    defaultMessage: "+{count} more — keep typing to filter",
  },
});

/**
 * The building-block palette.
 * @param {object} props
 * @param {boolean} props.includeAdult Whether nsfw-flagged blocks are shown.
 * @param {(token: string) => void} props.onInsert Insert a block token into the composer.
 * @param {(item: object, e: object) => void} props.onShowTip Show the hover tooltip.
 * @param {(e: object) => void} props.onMoveTip Move the hover tooltip.
 * @param {() => void} props.onHideTip Hide the hover tooltip.
 * @returns {JSX.Element}
 */
export default function BlockPalette({ includeAdult, onInsert, onShowTip, onMoveTip, onHideTip }) {
  const intl = useIntl();
  const [version, setVersion] = useState(0); // bump to refresh custom blocks
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState(""); // top group: Blocks | Lists
  const [activeSub, setActiveSub] = useState("All"); // folder sub-tab within the active group

  // Rebuild the block palette when custom blocks change or the NSFW switch flips (nsfw-flagged
  // generators are hidden entirely when adult is off).
  const blocks = useMemo(() => getBlocks({ includeAdult }), [version, includeAdult]);

  // Rebuild the palette when the catalog hot-applies (a Manage edit / refresh re-reads disk).
  useEffect(() => subscribeCatalog(() => setVersion((v) => v + 1)), []);

  // Filter blocks by the single search box (matches token or label). Category pills
  // (the Lists folder headers) are kept only when a following entry survives.
  const q = query.trim().toLowerCase();
  const matchItem = (i) =>
    (i.token || "").toLowerCase().includes(q) || (i.label || "").toLowerCase().includes(q);
  function filterItems(items) {
    if (!q) return items;
    const out = [];
    for (let k = 0; k < items.length; k++) {
      const i = items[k];
      if (i.category) {
        let any = false;
        for (let j = k + 1; j < items.length && !items[j].category; j++)
          if (matchItem(items[j])) {
            any = true;
            break;
          }
        if (any) out.push(i);
      } else if (matchItem(i)) {
        out.push(i);
      }
    }
    return out;
  }
  const effItems = (b) => b.items;
  const filtered = blocks
    .map((b) => ({ ...b, items: filterItems(effItems(b)) }))
    .filter((b) => b.items.some((i) => !i.category));

  // The active top group (Blocks / Lists), falling back to the first available.
  const active = filtered.find((b) => b.title === activeCat) || filtered[0] || null;
  const searching = !!q;
  // Folder sub-categories of the active group, and the currently-selected one (default All).
  const subCats = active ? foldersOf(active) : [];
  const effSub =
    activeSub === "All" || subCats.some((c) => c.label === activeSub) ? activeSub : "All";

  // The chips to render. Searching → the flat matched run. All → every chip across folders, plus
  // the insertable group pills (the plain folder headers are sub-tabs now, so they're dropped). A
  // folder sub-tab → that folder's chips, led by its whole-group insert pill when it has one.
  let activeItems;
  if (searching) {
    activeItems = active ? active.items.filter((i) => !i.category) : [];
  } else if (effSub === "All") {
    // All = every category shown with its pill header + buttons (special/any included as pills).
    activeItems = active ? active.items : [];
  } else {
    const cat = subCats.find((c) => c.label === effSub);
    activeItems = cat
      ? [
          ...(cat.token
            ? [{ category: true, token: cat.token, label: cat.label, description: cat.description }]
            : []),
          ...cat.items,
        ]
      : [];
  }

  return (
    <aside className="sidebar">
      <div className="panel-head">
        <h3 className="panel-title">{intl.formatMessage(msgs.buildingBlocks)}</h3>
        <input
          className="picker-filter"
          placeholder={intl.formatMessage(msgs.searchBlocks)}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="empty">{intl.formatMessage(msgs.noBlocks, { query })}</p>
      ) : (
        <>
          {/* Both groups (Blocks / Lists) are always listed, each with an "All" row and its folder
              sub-categories indented beneath it. The group header is a plain label; its "All" row
              carries the selection. Sub-tabs are hidden while searching (results go flat). */}
          <nav className="cat-tabs">
            {filtered.map((b) => {
              const isActiveGroup = !!active && active.title === b.title;
              const groupFolders = foldersOf(b);
              const selectGroup = () => {
                setActiveCat(b.title);
                setActiveSub("All");
              };
              return (
                <Fragment key={b.title}>
                  <button className="cat-tab" onClick={selectGroup}>
                    <span className="cat-name">{b.title}</span>
                    <span className="count-pill">{b.items.filter((i) => !i.category).length}</span>
                  </button>
                  {!searching && (
                    <button
                      className={`cat-tab sub${isActiveGroup && effSub === "All" ? " on" : ""}`}
                      onClick={selectGroup}
                    >
                      <span className="cat-name">{intl.formatMessage(msgs.all)}</span>
                      <span className="count-pill">
                        {b.items.filter((i) => !i.category).length}
                      </span>
                    </button>
                  )}
                  {!searching &&
                    groupFolders.map((c) => (
                      <button
                        key={c.label}
                        className={`cat-tab sub${isActiveGroup && effSub === c.label ? " on" : ""}`}
                        onClick={() => {
                          setActiveCat(b.title);
                          setActiveSub(c.label);
                        }}
                        title={c.description || c.label}
                      >
                        <span className="cat-name">{c.label}</span>
                        <span className="count-pill">{c.items.length}</span>
                      </button>
                    ))}
                </Fragment>
              );
            })}
          </nav>

          <div className="chip-area">
            {/* Description callout: the group hint on the "all" view, or the selected folder's
                own description when a sub-tab is active. */}
            {!searching &&
              (() => {
                const desc =
                  effSub === "All"
                    ? active?.hint
                    : subCats.find((c) => c.label === effSub)?.description;
                return desc ? (
                  <p className="cat-hint">
                    <span className="cat-hint-icon" aria-hidden="true">
                      ⓘ
                    </span>
                    <span className="cat-hint-text">{desc}</span>
                  </p>
                ) : null;
              })()}
            <div className="picker-list">
              {activeItems.slice(0, 400).map((i, idx) =>
                i.category ? (
                  i.token ? (
                    <button
                      key={`cat-${i.label}-${idx}`}
                      className="cat-pill cat-pill-group"
                      onMouseEnter={(e) => onShowTip(i, e)}
                      onMouseMove={onMoveTip}
                      onMouseLeave={onHideTip}
                      onClick={() => onInsert(i.token)}
                    >
                      {i.label}
                    </button>
                  ) : (
                    <span
                      key={`cat-${i.label}-${idx}`}
                      className="cat-pill"
                      title={i.description || i.label}
                    >
                      {i.label}
                    </span>
                  )
                ) : (
                  <button
                    key={i.token}
                    className="chip"
                    onMouseEnter={(e) => onShowTip(i, e)}
                    onMouseMove={onMoveTip}
                    onMouseLeave={onHideTip}
                    onClick={() => onInsert(i.token)}
                  >
                    {i.label}
                  </button>
                ),
              )}
              {activeItems.length > 400 && (
                <span className="picker-more">
                  {intl.formatMessage(msgs.moreFilter, { count: activeItems.length - 400 })}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
