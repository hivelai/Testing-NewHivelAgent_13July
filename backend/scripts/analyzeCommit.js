#!/usr/bin/env node
const { computeCommitMetrics } = require('../services/gitCommitMetrics');

async function main() {
  const [, , repoPath, commitSha, parentSha] = process.argv;
  if (!repoPath || !commitSha) {
    console.error('Usage: node scripts/analyzeCommit.js <repoPath> <commitSha> [parentSha]');
    process.exit(1);
  }

  const metrics = await computeCommitMetrics(repoPath, commitSha, parentSha);
  console.log(JSON.stringify(metrics, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
