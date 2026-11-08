import "../load-env";
import { createHmac, randomBytes } from "node:crypto";
import postgres from "postgres";

/**
 * Dev/e2e helper: mints a 30-day session cookie for SUPERADMIN_EMAIL (or the
 * email passed as argv[2]) and prints the raw token. Never use in production.
 */
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("not for production");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const email = (process.argv[2] ?? process.env.SUPERADMIN_EMAIL ?? "").toLowerCase();
  const [user] = await sql`select id from users where lower(email) = ${email}`;
  if (!user) throw new Error(`user ${email} not found; run pnpm db:seed`);
  const token = randomBytes(32).toString("base64url");
  const hash = createHmac("sha256", process.env.SESSION_SECRET!).update(token).digest("hex");
  await sql`insert into sessions (user_id, token_hash, expires_at)
            values (${user.id}, ${hash}, now() + interval '30 days')`;
  console.log(token);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
