/**
 * @file ContentColumn renders its children at BOTH phone and tablet sizes — the core "no size-based
 * feature loss" invariant: switching size only changes the column width, never what's shown.
 */
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import ContentColumn from "../ContentColumn.js";

jest.mock("../../lib/responsive.js", () => ({ useResponsive: jest.fn() }));
import { useResponsive } from "../../lib/responsive.js";

describe("ContentColumn", () => {
  it("passes children through on phones", () => {
    useResponsive.mockReturnValue({ isTabletOrWider: false, contentMaxWidth: 960 });
    const { getByText } = render(
      <ContentColumn>
        <Text>surface content</Text>
      </ContentColumn>,
    );
    expect(getByText("surface content")).toBeTruthy();
  });

  it("still renders the same children inside a centered column on tablet/wide", () => {
    useResponsive.mockReturnValue({ isTabletOrWider: true, contentMaxWidth: 960 });
    const { getByText } = render(
      <ContentColumn max={1100}>
        <Text>surface content</Text>
      </ContentColumn>,
    );
    expect(getByText("surface content")).toBeTruthy();
  });
});
