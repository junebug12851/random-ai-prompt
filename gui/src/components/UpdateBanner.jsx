/**
 * The check-and-notify update banner: a slim, dismissible strip shown below the header when a newer
 * GitHub release exists than the running build. Edition-aware — the call to action fits how THIS
 * edition updates (download the new installer/portable/release, or, for a git checkout, a copyable
 * `git pull` command). It never auto-installs anything: this is the lowest-fragility first rung of
 * the updates design (see notes/plans/updates-upgrades.md); the full desktop auto-installer is the
 * scaffolded Phase 2. Local/desktop only — the online build never renders it.
 *
 * SSR-safe: it renders `null` until the client-side check resolves (the effect never runs during the
 * online build's prerender), so it adds nothing to the server markup and can't cause a hydration
 * mismatch.
 * @module gui/components/UpdateBanner
 */
import { useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { useUpdateCheck } from "../lib/useUpdateCheck.js";
import { DownloadIcon, ExternalLinkIcon, CloseIcon, CopyIcon, SparkleIcon } from "./icons.jsx";

const msgs = defineMessages({
  available: {
    id: "update.available",
    defaultMessage: "Version {version} is available.",
    description: "Update banner headline; {version} is the new release number",
  },
  download: {
    id: "update.download",
    defaultMessage: "Download",
    description: "Update banner button that opens the release download page",
  },
  viewRelease: {
    id: "update.viewRelease",
    defaultMessage: "View release",
    description: "Update banner button that opens the release page (git edition)",
  },
  gitHint: {
    id: "update.gitHint",
    defaultMessage: "Update your checkout:",
    description: "Label before the copyable git update command",
  },
  copy: {
    id: "update.copy",
    defaultMessage: "Copy command",
    description: "aria-label/title for the button that copies the git update command",
  },
  copied: {
    id: "update.copied",
    defaultMessage: "Copied",
    description: "Confirmation shown briefly after copying the git command",
  },
  dismiss: {
    id: "update.dismiss",
    defaultMessage: "Dismiss",
    description: "aria-label/title for the button that dismisses the update banner",
  },
});

// The exact command a git-checkout user runs to update safely (never clobbers the working tree).
const GIT_COMMAND = "git pull --ff-only && npm install";

/**
 * @returns {JSX.Element|null} The update banner, or `null` when there's nothing to offer.
 */
export default function UpdateBanner() {
  const intl = useIntl();
  const { update, dismiss } = useUpdateCheck();
  const [copied, setCopied] = useState(false);

  if (!update) return null;

  const isGit = update.edition === "git";

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(GIT_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the command is visible to copy by hand */
    }
  };

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <div className="update-banner-head">
        <span className="update-banner-icon" aria-hidden="true">
          <SparkleIcon />
        </span>
        <span className="update-banner-text">
          {intl.formatMessage(msgs.available, { version: update.version })}
        </span>
      </div>

      {isGit && (
        <span className="update-banner-cmd">
          <span className="update-banner-cmd-label">{intl.formatMessage(msgs.gitHint)}</span>
          <code>{GIT_COMMAND}</code>
          <button
            type="button"
            className="update-banner-copy"
            onClick={copyCommand}
            title={intl.formatMessage(msgs.copy)}
            aria-label={intl.formatMessage(msgs.copy)}
          >
            <CopyIcon />
            {copied && <span className="update-banner-copied">{intl.formatMessage(msgs.copied)}</span>}
          </button>
        </span>
      )}

      <a
        className="update-banner-cta"
        href={update.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={dismiss}
      >
        {isGit ? (
          <>
            {intl.formatMessage(msgs.viewRelease)}
            <ExternalLinkIcon />
          </>
        ) : (
          <>
            <DownloadIcon />
            {intl.formatMessage(msgs.download)}
          </>
        )}
      </a>

      <button
        type="button"
        className="update-banner-close"
        onClick={dismiss}
        title={intl.formatMessage(msgs.dismiss)}
        aria-label={intl.formatMessage(msgs.dismiss)}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
