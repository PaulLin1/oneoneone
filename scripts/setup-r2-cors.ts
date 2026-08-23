import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";

/**
 * One-time (or re-run-if-ever-in-doubt) setup: R2 buckets have no CORS
 * policy by default. A plain <img> or direct navigation to an object's
 * public URL works fine either way — but CSS `mask-image`/`-webkit-mask-
 * image` (what components/AuthorMark.tsx uses to render portraits) is
 * treated as a cross-origin sub-resource load by some browsers (Safari/
 * WebKit in particular), which silently fails — renders as fully
 * transparent, no error, no broken-image icon — without an explicit
 * `Access-Control-Allow-Origin` header on the response. This is exactly
 * what caused portraits to render as blank space in Safari-family browsers
 * despite the object itself being perfectly reachable by direct URL.
 *
 * `AllowedOrigins: ["*"]` is fine here: every object in this bucket is a
 * public, non-sensitive portrait image meant to be embedded anywhere.
 */
async function main() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    console.error("Missing one of R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME.");
    process.exit(1);
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["*"],
            AllowedMethods: ["GET", "HEAD"],
            AllowedHeaders: ["*"],
            MaxAgeSeconds: 86400,
          },
        ],
      },
    })
  );

  const result = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log("CORS policy set:");
  console.log(JSON.stringify(result.CORSRules, null, 2));
}

main();
