/**
 * Secure per-provider API-key storage (BYOK). Keys live in the OS keystore via expo-secure-store —
 * never in plain settings, never synced. Web-safe: on react-native-web (headless UI verification)
 * SecureStore isn't available, so reads return "" and writes no-op.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const WEB = Platform.OS === "web";
const K = (id) => `rap_key_${id}`;

export async function getKey(id) {
  if (WEB) return "";
  try {
    return (await SecureStore.getItemAsync(K(id))) || "";
  } catch {
    return "";
  }
}

/**
 * Persist (or, for an empty value, delete) a key. Returns `true` on success and `false` if the native
 * keystore write failed — so the caller can tell a real save from a silent failure and warn the user,
 * rather than BYOK appearing saved when it never reached the keystore. (Web is a no-op → `true`.)
 */
export async function setKey(id, value) {
  if (WEB) return true;
  try {
    if (value) await SecureStore.setItemAsync(K(id), value);
    else await SecureStore.deleteItemAsync(K(id));
    return true;
  } catch {
    return false;
  }
}
