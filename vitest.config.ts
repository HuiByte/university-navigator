import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

// Vitest 配置：纯逻辑单测，环境设为 node
// 别名 @/* 与 tsconfig.json 保持一致，指向 ./src/*
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
})
