import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth/session";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST() {
  await destroySession();
  return NextResponse.redirect(new URL("/login", env.APP_URL), { status: 303 });
}
