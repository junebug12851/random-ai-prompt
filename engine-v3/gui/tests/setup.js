/**
 * @file Vitest setup for the SPA suite: Testing Library DOM matchers + auto-cleanup,
 * and a clean localStorage between tests (the settings/custom stores persist there).
 */
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});
