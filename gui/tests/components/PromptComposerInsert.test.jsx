/**
 * @file Regression test for PromptComposer's `insert()` — two rapid inserts (before React commits)
 * must both append, not have the second overwrite the first from a stale render-time value.
 */
import { describe, it, expect } from "vitest";
import { useRef, useState } from "react";
import { render, act } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import PromptComposer from "../../src/components/PromptComposer.jsx";

describe("PromptComposer.insert", () => {
  it("accumulates two back-to-back inserts instead of dropping the first", () => {
    const composerRef = { current: null };
    let latest = null;

    function Harness() {
      const [settings, setSettings] = useState({
        prompt: "",
        provider: "no-such-provider",
        providerParams: {},
        rewriteProvider: "none",
        promptCount: 1,
        autoFix: false,
        autoKeyword: false,
      });
      latest = settings;
      const ref = useRef(null);
      composerRef.current = ref;
      return (
        <PromptComposer
          ref={ref}
          settings={settings}
          setSettings={setSettings}
          onGenerate={() => {}}
        />
      );
    }

    render(
      <IntlProvider locale="en" messages={{}} onError={() => {}}>
        <Harness />
      </IntlProvider>,
    );

    act(() => {
      composerRef.current.current.insert("alpha");
      composerRef.current.current.insert("beta");
    });

    expect(latest.prompt).toBe("alpha, beta");
  });
});
