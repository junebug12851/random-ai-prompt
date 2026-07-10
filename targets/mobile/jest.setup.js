/**
 * @file Jest setup for the mobile target — mocks the native modules that have no JS-only
 * implementation (so react-native components can mount in the jest-expo test renderer) and wires
 * React Native Testing Library. Kept small: app data modules (theme/storage/providers/engine) are
 * mocked per-test where the test needs to control inputs, not here.
 */
/* eslint-disable */
// Safe-area context ships its own jest mock.
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    SafeAreaInsetsContext: React.createContext(inset),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
    SafeAreaConsumer: ({ children }) => children(inset),
    initialWindowMetrics: { insets: inset, frame },
  };
});

// expo-image -> plain RN Image so <Image source={uri}/> renders as a host node.
jest.mock("expo-image", () => {
  const RN = require("react-native");
  return { Image: RN.Image };
});

// FlashList -> a minimal list that renders the header + each row (enough to assert content/interaction).
jest.mock("@shopify/flash-list", () => {
  const React = require("react");
  const { ScrollView } = require("react-native");
  const FlashList = ({ ListHeaderComponent, ListEmptyComponent, data = [], renderItem, keyExtractor }) => {
    const header = ListHeaderComponent
      ? React.isValidElement(ListHeaderComponent) ? ListHeaderComponent : React.createElement(ListHeaderComponent)
      : null;
    const emptyEl = ListEmptyComponent
      ? (React.isValidElement(ListEmptyComponent) ? ListEmptyComponent : React.createElement(ListEmptyComponent))
      : null;
    const rows = (data && data.length)
      ? data.map((item, index) =>
          React.createElement(React.Fragment, { key: keyExtractor ? keyExtractor(item, index) : String(index) },
            renderItem ? renderItem({ item, index }) : null))
      : (emptyEl ? [emptyEl] : []);
    return React.createElement(ScrollView, null, header, rows);
  };
  return { FlashList };
});

// expo-file-system/legacy — an in-memory-ish stub (tests that care mock it further).
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///doc/",
  EncodingType: { Base64: "base64" },
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  makeDirectoryAsync: jest.fn(async () => {}),
  readAsStringAsync: jest.fn(async () => "{}"),
  writeAsStringAsync: jest.fn(async () => {}),
  readDirectoryAsync: jest.fn(async () => []),
  deleteAsync: jest.fn(async () => {}),
  copyAsync: jest.fn(async () => {}),
  downloadAsync: jest.fn(async () => ({ uri: "file:///doc/img.png" })),
}), { virtual: true });

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(async () => ({ uri: "file:///out.png", width: 512, height: 512 })),
  SaveFormat: { PNG: "png", JPEG: "jpeg", WEBP: "webp" },
}));
jest.mock("expo-media-library", () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  saveToLibraryAsync: jest.fn(async () => {}),
}));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => {}) }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
