import { fetchCandidates } from "@/lib/fetchCandidates";

async function main() {
  const batchSize = Number(process.argv[2] ?? 3);
  await fetchCandidates(batchSize);
}

main();
