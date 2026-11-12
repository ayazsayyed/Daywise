import { loadEnvFiles } from "../src/lib/env-files";

// Scripts (migrate, seed, gen, worker): shell > .env.local > .env (same as Next.js).
loadEnvFiles();
