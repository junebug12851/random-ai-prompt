/**
 * The header overflow menu: a single icon button that opens a small popover of links —
 * the project's GitHub repo, the live web app's home (the fairyfox hub), and the project docs,
 * followed (below a separator) by the app's own legal pages (Privacy, Terms, Cookies).
 * Lives in the top bar on every tab. Every item opens in a new tab with `rel="noopener noreferrer"`;
 * the legal pages are same-origin static pages under `/legal/`, opened in a new tab too so the
 * app keeps its in-memory state.
 * @module gui/components/LinksMenu
 */
import { useEffect, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { Select } from "./Field.jsx";
import { AUTO_LOCALE, SUPPORTED_LOCALES, LOCALES } from "../i18n/index.js";
import {
  MenuIcon,
  GitHubIcon,
  BookIcon,
  HomeIcon,
  ExternalLinkIcon,
  ShieldIcon,
  FileTextIcon,
  CookieIcon,
} from "./icons.jsx";

// External destinations. Kept here (not in `online.js`) so the menu owns its own link set.
const LINKS = {
  github: "https://github.com/junebug12851/random-ai-prompt",
  docs: "https://fairyfox.io/random-ai-prompt/",
  home: "https://fairyfox.io",
};

// The app's own legal pages — same-origin static pages served from `gui/public/legal/`.
const LEGAL = {
  privacy: "/legal/privacy.html",
  terms: "/legal/terms.html",
  cookies: "/legal/cookies.html",
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
  privacy: { id: "linksMenu.privacy", defaultMessage: "Privacy Policy" },
  privacyDesc: { id: "linksMenu.privacyDesc", defaultMessage: "What we collect (almost nothing)" },
  terms: { id: "linksMenu.terms", defaultMessage: "Terms & Conditions" },
  termsDesc: { id: "linksMenu.termsDesc", defaultMessage: "The rules for using the app" },
  cookies: { id: "linksMenu.cookies", defaultMessage: "Cookies Policy" },
  cookiesDesc: { id: "linksMenu.cookiesDesc", defaultMessage: "We don't use cookies" },
  language: { id: "linksMenu.language", defaultMessage: "Language" },
  localeAuto: {
    id: "linksMenu.localeAuto",
    defaultMessage: "Auto (browser)",
    description: "Locale option that follows the browser's language",
  },
});

/**
 * @returns {JSX.Element} The header links menu.
 */
export default function LinksMenu({ settings, setSettings }) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);

  // App-wide display-language picker lives in this menu (alongside the project links + legal pages).
  const localeOptions = [
    { value: AUTO_LOCALE, label: intl.formatMessage(msgs.localeAuto) },
    ...SUPPORTED_LOCALES.map((code) => ({ value: code, label: LOCALES[code].label })),
  ];

  // Close on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // `external: true` items get the little outbound-link glyph; the legal pages are part of the app
  // (same origin), so they omit it even though they also open in a new tab.
  const groups = [
    [
      { href: LINKS.github, Icon: GitHubIcon, label: msgs.github, desc: msgs.githubDesc, external: true },
      { href: LINKS.docs, Icon: BookIcon, label: msgs.docs, desc: msgs.docsDesc, external: true },
      { href: LINKS.home, Icon: HomeIcon, label: msgs.home, desc: msgs.homeDesc, external: true },
    ],
    [
      { href: LEGAL.privacy, Icon: ShieldIcon, label: msgs.privacy, desc: msgs.privacyDesc },
      { href: LEGAL.terms, Icon: FileTextIcon, label: msgs.terms, desc: msgs.termsDesc },
      { href: LEGAL.cookies, Icon: CookieIcon, label: msgs.cookies, desc: msgs.cookiesDesc },
    ],
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
        <span className="ctl-label">{intl.formatMessage(msgs.links)}</span>
      </button>
      {open && (
        <>
          <div className="links-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="links-pop" role="menu" aria-label={intl.formatMessage(msgs.links)}>
            {setSettings && (
              <div className="links-group links-lang" role="group">
                <Select
                  label={intl.formatMessage(msgs.language)}
                  value={settings?.locale ?? AUTO_LOCALE}
                  onChange={(v) => setSettings((s) => ({ ...s, locale: v }))}
                  options={localeOptions}
                />
                <div className="links-sep" role="separator" />
              </div>
            )}
            {groups.map((items, gi) => (
              <div key={gi} className="links-group" role="group">
                {gi > 0 && <div className="links-sep" role="separator" />}
                {items.map(({ href, Icon, label, desc, external }) => (
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
                    {external && (
                      <span className="links-item-ext" aria-hidden="true">
                        <ExternalLinkIcon />
                      </span>
                    )}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
