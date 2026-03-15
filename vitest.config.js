/**
 * vitest.config.js — Test runner configuration.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    testTimeout: 15000,
  },
});
