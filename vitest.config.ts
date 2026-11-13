import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Most specific first – Vite takes the first alias that matches.
      "@/lib/db": path.resolve(__dirname, "tests/stubs/db.ts"),
      "@": path.resolve(__dirname, "src"),
      // Lets tests import server modules (settings, validation) directly.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
});
