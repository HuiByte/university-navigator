import { z } from "zod";

/**
 * 环境变量校验 Schema
 * 在应用启动时（模块加载阶段）校验所有关键环境变量，
 * 缺失或格式错误时抛出清晰错误并中断启动。
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_BASE_URL: z.string().min(1),
  OPENAI_MODEL: z.string().min(1),
  AUTH_GITHUB_ID: z.string().min(1),
  AUTH_GITHUB_SECRET: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ 环境变量校验失败，请检查 .env / .env.local 配置：");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  throw new Error("Invalid environment variables: 请检查上述缺失或格式错误的变量");
}

export const env = parsed.data;
