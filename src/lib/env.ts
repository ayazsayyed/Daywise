import { z } from "zod";

/**
 * Runtime environment contract. `.env.example` is the source of truth; every
 * variable added there must be declared here. Secrets never leave this module
 * except through the typed `env` object.
 */
const schema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** Where the worker reaches the app to print PDFs (compose: http://app:3000). Defaults to APP_URL. */
  INTERNAL_APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SUPERADMIN_EMAIL: z.string().email(),

  DATABASE_URL: z.string().min(1),

  AI_PROVIDER: z.enum(["groq", "gemini", "deepseek", "qwen"]).default("groq"),
  AI_FALLBACK_PROVIDER: z.enum(["groq", "gemini", "deepseek", "qwen"]).default("gemini"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_REASONING_EFFORT: z.enum(["none", "low", "medium", "high"]).default("low"),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  DEEPSEEK_API_KEY: z.string().optional(),
  QWEN_API_KEY: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  MOCK_AI: z.enum(["0", "1"]).default("0"),

  GOOGLE_PLACES_API_KEY: z.string().optional(),
  PLACES_MONTHLY_TEXT_SEARCH_CAP: z.coerce.number().int().default(30000),
  PLACES_MONTHLY_PHOTO_CAP: z.coerce.number().int().default(900),

  PEXELS_API_KEY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Daywise <login@smallsoftware.in>"),
  SUPPORT_EMAIL: z.string().email().default("support@smallsoftware.in"),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().default("daywise"),
  R2_PUBLIC_URL: z.string().url().optional().or(z.literal("")),

  SENTRY_DSN: z.string().optional(),
  /** Browser DSN; inlined at build time (Docker build arg). Usually equals SENTRY_DSN. */
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  /** Git SHA of the deployed image (compose sets it from IMAGE_TAG). */
  SENTRY_RELEASE: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}

let cached: Env | undefined;

/** Lazily validated env. Throws on first access if required variables are missing. */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    cached ??= load();
    return cached[prop as keyof Env];
  },
});

export const isProd = () => env.NODE_ENV === "production";
