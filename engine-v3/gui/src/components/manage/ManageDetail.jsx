/**
 * The Manage right-pane detail/preview for the current selection: what was selected (path, kind,
 * attributes) and a read-only, length-capped content preview. The full editors are separate.
 * @module gui/components/manage/ManageDetail
 */
import { useIntl, defineMessages } from "react-intl";

const msgs = defineMessages({
  detailEmpty: {
    id: "manage.detailEmpty",
    defaultMessage: "Select a block, list, or folder on the left to inspect it. Editing arrives next.",
  },
  rootParen: { id: "manage.rootParen", defaultMessage: "(root)" },
  mPath: { id: "manage.mPath", defaultMessage: "Path" },
  mType: { id: "manage.mType", defaultMessage: "Type" },
  mAttributes: { id: "manage.mAttributes", defaultMessage: "Attributes" },
  mEntries: { id: "manage.mEntries", defaultMessage: "Entries" },
  typeCategory: { id: "manage.typeCategory", defaultMessage: "Category (top-level)" },
  typeSubfolder: { id: "manage.typeSubfolder", defaultMessage: "Subfolder" },
  attrNone: { id: "manage.attrNone", defaultMessage: "none" },
  folderSoon: {
    id: "manage.folderSoon",
    defaultMessage: "The folder settings editor (rename, priority, markers) arrives next.",
  },
  mGating: { id: "manage.mGating", defaultMessage: "Gating" },
  mNsfwVal: { id: "manage.mNsfwVal", defaultMessage: "NSFW" },
  mSidecar: { id: "manage.mSidecar", defaultMessage: "Sidecar" },
  mSidecarVal: { id: "manage.mSidecarVal", defaultMessage: "has a JS sidecar" },
  loading: { id: "manage.loading", defaultMessage: "Loading…" },
  entrySoon: {
    id: "manage.entrySoon",
    defaultMessage: "A full editor (with save + hot-apply) arrives next.",
  },
  moreLines: {
    id: "manage.moreLines",
    defaultMessage: "… {count} more lines (full editor coming).",
  },
});

// Cap the read-only preview so an enormous list stays snappy here; the real editor handles full size.
function previewText(intl, text) {
  if (text == null) return "";
  const lines = text.split("\n");
  if (lines.length <= 500) return text;
  return `${lines.slice(0, 500).join("\n")}\n\n${intl.formatMessage(msgs.moreLines, { count: lines.length - 500 })}`;
}

/**
 * The right-pane detail/preview for the current selection.
 * @param {object} props
 * @param {object|null} props.selected The selected entry or folder.
 * @returns {JSX.Element}
 */
export default function ManageDetail({ selected }) {
  const intl = useIntl();
  if (!selected) {
    return (
      <section className="card mg-detail mg-detail-empty">
        <p>{intl.formatMessage(msgs.detailEmpty)}</p>
      </section>
    );
  }
  if (selected.kind === "folder") {
    return (
      <section className="card mg-detail">
        <h2 className="mg-detail-title">{selected.name || intl.formatMessage(msgs.rootParen)}</h2>
        <dl className="mg-meta">
          <dt>{intl.formatMessage(msgs.mPath)}</dt>
          <dd>
            <code>{selected.root}/{selected.path}</code>
          </dd>
          <dt>{intl.formatMessage(msgs.mType)}</dt>
          <dd>{intl.formatMessage(selected.isCategory ? msgs.typeCategory : msgs.typeSubfolder)}</dd>
          <dt>{intl.formatMessage(msgs.mAttributes)}</dt>
          <dd>{selected.markers.length ? selected.markers.join(", ") : intl.formatMessage(msgs.attrNone)}</dd>
          <dt>{intl.formatMessage(msgs.mEntries)}</dt>
          <dd>{selected.entryCount}</dd>
        </dl>
        <p className="mg-soon">{intl.formatMessage(msgs.folderSoon)}</p>
      </section>
    );
  }
  return (
    <section className="card mg-detail">
      <h2 className="mg-detail-title">
        {selected.label} <span className={`mg-kind kind-${selected.kind}`}>{selected.kind}</span>
      </h2>
      <dl className="mg-meta">
        <dt>{intl.formatMessage(msgs.mPath)}</dt>
        <dd>
          <code>{selected.root}/{selected.path}.{selected.ext}</code>
        </dd>
        {selected.nsfw && (
          <>
            <dt>{intl.formatMessage(msgs.mGating)}</dt>
            <dd>{intl.formatMessage(msgs.mNsfwVal)}</dd>
          </>
        )}
        {selected.hasJsSidecar && (
          <>
            <dt>{intl.formatMessage(msgs.mSidecar)}</dt>
            <dd>{intl.formatMessage(msgs.mSidecarVal)}</dd>
          </>
        )}
      </dl>
      <div className="mg-preview">
        {selected.loading ? (
          <p className="empty">{intl.formatMessage(msgs.loading)}</p>
        ) : selected.error ? (
          <p className="error">{selected.error}</p>
        ) : (
          <pre className="mg-preview-pre">{previewText(intl, selected.text)}</pre>
        )}
      </div>
      <p className="mg-soon">{intl.formatMessage(msgs.entrySoon)}</p>
    </section>
  );
}
