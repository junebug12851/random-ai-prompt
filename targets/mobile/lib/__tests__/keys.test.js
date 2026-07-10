/**
 * @file Unit tests for the BYOK secure key store (lib/keys.js) — expo-secure-store mocked.
 */
import * as SecureStore from "expo-secure-store";
import { getKey, setKey } from "../keys.js";

beforeEach(() => jest.clearAllMocks());

describe("keys", () => {
  it("getKey returns the stored value under the namespaced id", async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce("secret");
    expect(await getKey("openai")).toBe("secret");
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("rap_key_openai");
  });
  it("getKey returns '' when absent or on error", async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce(null);
    expect(await getKey("x")).toBe("");
    SecureStore.getItemAsync.mockRejectedValueOnce(new Error("boom"));
    expect(await getKey("x")).toBe("");
  });
  it("setKey writes a value and deletes when cleared", async () => {
    await setKey("openai", "k");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("rap_key_openai", "k");
    await setKey("openai", "");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("rap_key_openai");
  });
});