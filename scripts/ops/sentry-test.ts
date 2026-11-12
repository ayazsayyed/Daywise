/**
 * Worker-side Sentry test: `pnpm tsx --import ./src/worker/instrument.ts scripts/ops/sentry-test.ts`
 * Sends one warning through `alert()` and prints the event id.
 */
import * as Sentry from "@sentry/node";

import { alert } from "../../src/lib/alerts";

async function main() {
  if (!process.env.SENTRY_DSN) {
    console.log(JSON.stringify({ ok: false, reason: "SENTRY_DSN not set" }));
    process.exit(1);
  }
  const eventId = await alert("warning", "ops_sentry_test", "Sentry test event from worker (ops)", {
    at: new Date().toISOString(),
  });
  await Sentry.flush(5000);
  console.log(JSON.stringify({ ok: Boolean(eventId), service: "worker", eventId }));
}

void main();
