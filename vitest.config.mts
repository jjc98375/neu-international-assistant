import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    // "**/.claude/**" keeps vitest from discovering third-party package tests
    // inside nested git-worktree node_modules under .claude/worktrees/.
    exclude: ["__tests__/integration/**", "node_modules/**", "**/.claude/**"],
  },
});
