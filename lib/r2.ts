import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * R2 is S3-compatible, so the AWS SDK works against it unmodified — just
 * point the endpoint at the account-scoped R2 URL. Client is built lazily
 * (not at module load) for the same reason lib/auth-db.ts's Pool is: this
 * can end up imported from a route bundled at `next build` time, and
 * shouldn't need R2 credentials just to build.
 */
let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY.");
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

function bucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("Missing R2_BUCKET_NAME.");
  return bucket;
}

function publicUrl(): string {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) throw new Error("Missing R2_PUBLIC_URL.");
  return url.replace(/\/$/, "");
}

/** Uploads a portrait PNG and returns its public URL. Overwrites any existing object at the same key. */
export async function uploadAuthorPortrait(slug: string, data: Buffer): Promise<string> {
  const key = `authors/${slug}.png`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Body: data,
      ContentType: "image/png",
      // Not `immutable`: the key is stable per author (authors/<slug>.png),
      // and a re-process/re-crop overwrites it in place — a day-long cache
      // is enough to be fast without needing cache-busting on every update.
      CacheControl: "public, max-age=86400",
    })
  );
  return `${publicUrl()}/${key}`;
}

export async function deleteAuthorPortrait(slug: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: `authors/${slug}.png` }));
}
