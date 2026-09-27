import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // The socket tests bind real TCP ports and the connection layer holds a
    // module-level mutex; running files sequentially keeps them deterministic.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
