import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "https://www.chiphell.com/"
      }
    },
    globals: true,
    include: ["test/**/*.test.ts"]
  }
});
