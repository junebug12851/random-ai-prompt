/**
 * The header overflow menu: a single icon button that opens a small popover of external links —
 * the project's GitHub repo, the live web app's home (the fairyfox hub), and the project docs.
 * Lives in the top bar on every tab. Each item opens in a new tab with `rel="noopener noreferrer"`.
 * @module gui/components/LinksMenu
 */
import { useEffect, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { MenuIcon, GitHubIcon, BookIcon, HomeIcon, ExternalLinkIcon } from "./icons.jsx";

// External destinations. Kept here (not in `online.js`) so the menu owns its own link set.
const LINKS = {
  github: "https://github.com/junebug12851/random-ai-prompt",
  docs: "https://fairyfox.io/random-ai-prompt/",
  home: "https://fairyfox.io",
};

const msgs = defineMessages({
  menu: { id: "linksMenu.menu", defaultMessage: "Menu" },
  links: { id: "linksMenu.links", defaultMessage: "Links" },
  github: { id: "linksMenu.github", defaultMessage: "GitHub repository" },
  githubDesc: { id: "linksMenu.githubDesc", defaultMessage: "Source code, issues, and releases" },
  docs: { id: "linksMenu.docs", defaultMessage: "Project docs" },
  docsDesc: { id: "linksMenu.docsDesc", defaultMessage: "API reference and developer guide" },
  home: { id: "linksMenu.home", defaultMessage: "fairyfox.io" },
  homeDesc: { id: "linksMenu.homeDesc", defaultMessage: "The fairyfox project home" },
});

/**
 * @returns {JSX.Element} The header links menu.
 */
export default function LinksMenu() {
  const intl = useIntl();
  const [open, setOpen] = useState(false);

  // Close on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const items = [
    { href: LINKS.github, Icon: GitHubIcon, label: msgs.github, desc: msgs.githubDesc },
    { href: LINKS.docs, Icon: BookIcon, label: msgs.docs, desc: msgs.docsDesc },
    { href: LINKS.home, Icon: HomeIcon, label: msgs.home, desc: msgs.homeDesc },
  ];

  return (
    <div className="links-menu">
      <button
        className={`links-trigger${open ? " on" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title={intl.formatMessage(msgs.menu)}
        aria-label={intl.formatMessage(msgs.menu)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MenuIcon />
      </button>
      {open && (
        <>
          <div className="links-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="links-pop" role="menu" aria-label={intl.formatMessage(msgs.links)}>
            {items.map(({ href, Icon, label, desc }) => (
              <a
                key={href}
                className="links-item"
                role="menuitem"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
              >
                <span className="links-item-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="links-item-text">
                  <span className="links-item-label">{intl.formatMessage(label)}</span>
                  <span className="links-item-desc">{intl.formatMessage(desc)}</span>
                </span>
                <span className="links-item-ext" aria-hidden="true">
                  <ExternalLinkIcon />
                </span>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
