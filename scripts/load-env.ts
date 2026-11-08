import { config } from "dotenv";

// Scripts (migrate, seed, gen, worker) load `.env` then `.env.local` (local overrides, gitignored).
config({ path: ".env", quiet: true });
config({ path: ".env.local", override: true, quiet: true });
