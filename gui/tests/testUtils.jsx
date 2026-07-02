/**
 * @file Testing helpers. Re-exports Testing Library and overrides `render` so the
 * subtree is wrapped in a react-intl `<IntlProvider>` (source locale `en`, no
 * catalog → components render from their inline `defaultMessage`). Component tests
 * that use `useIntl` / `<FormattedMessage>` should import `render` from here.
 */
import { render as rtlRender } from "@testing-library/react";
import { IntlProvider } from "react-intl";

export * from "@testing-library/react";

/** Wrapper that supplies the intl context. */
function IntlWrapper({ children }) {
  return (
    <IntlProvider locale="en" defaultLocale="en">
      {children}
    </IntlProvider>
  );
}

/**
 * `render` with an IntlProvider wrapper. Same signature as Testing Library's.
 * @param {import("react").ReactElement} ui The element under test.
 * @param {object} [options] Testing Library render options.
 * @returns {import("@testing-library/react").RenderResult}
 */
export function render(ui, options) {
  return rtlRender(ui, { wrapper: IntlWrapper, ...options });
}
