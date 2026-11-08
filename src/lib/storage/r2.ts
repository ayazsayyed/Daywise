import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "@/lib/env";

let client: S3Client | undefined;

export function r2Configured(): boolean {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
}

function r2(): S3Client {
  if (!r2Configured()) throw new Error("R2 is not configured (R2_ACCOUNT_ID / keys missing)");
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
  });
  return client;
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  cacheControl = "public, max-age=31536000, immutable",
) {
  await r2().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
}

export async function getObject(
  key: string,
): Promise<{ body: Uint8Array; contentType: string } | null> {
  try {
    const res = await r2().send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
    if (!res.Body) return null;
    const body = await res.Body.transformToByteArray();
    return { body, contentType: res.ContentType ?? "application/octet-stream" };
  } catch (err) {
    if ((err as { name?: string }).name === "NoSuchKey") return null;
    throw err;
  }
}

/** Public URL for an object: direct bucket/CDN URL when configured, else the app's file proxy. */
export function publicUrlFor(key: string): string {
  const base = env.R2_PUBLIC_URL
    ? env.R2_PUBLIC_URL.replace(/\/$/, "")
    : `${env.APP_URL}/api/files`;
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
