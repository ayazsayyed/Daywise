import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Editor } from "@/features/editor/editor";
import { toEditorDoc } from "@/features/editor/load";
import { requireTenant } from "@/lib/auth/guards";
import { NotFoundError } from "@/lib/db/itinerary";
import { tenantScope } from "@/lib/db/tenant";

export const metadata: Metadata = { title: "Itinerary" };

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const session = await requireTenant();
  const scope = tenantScope(session.tenant.id);
  const tree = await scope.getItineraryTree(id).catch((err) => {
    if (err instanceof NotFoundError) notFound();
    throw err;
  });
  return <Editor initial={toEditorDoc(tree)} defaults={session.tenant.defaults} />;
}
