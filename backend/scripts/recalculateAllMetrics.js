#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const CommitMetric = require('../models/CommitMetric');
const { computeAllCommitsMetrics } = require('../services/gitCommitMetrics');

async function main() {
  const [, , repoPath, ref] = process.argv;
  if (!repoPath) {
    console.error('Usage: node scripts/recalculateAllMetrics.js <repoPath> [ref=HEAD]');
    process.exit(1);
  }

  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mern_basic_app';
  await mongoose.connect(MONGO_URI);

  const allMetrics = await computeAllCommitsMetrics(repoPath, ref || 'HEAD');

  let count = 0;
  for (const metrics of allMetrics) {
    await CommitMetric.findOneAndUpdate(
      { repo: repoPath, commitSha: metrics.commitSha },
      {
        repo: repoPath,
        commitSha: metrics.commitSha,
        parentSha: metrics.parentSha,
        authorEmail: metrics.authorEmail,
        commitDate: metrics.commitDate,
        rework: metrics.rework,
        newwork: metrics.newwork,
        maintenance: metrics.maintenance,
        assistance: metrics.assistance,
        linesAdded: metrics.linesAdded,
        linesRemoved: metrics.linesRemoved,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    count++;
    console.log(`[${count}/${allMetrics.length}] ${metrics.commitSha} rework=${metrics.rework} newwork=${metrics.newwork} maintenance=${metrics.maintenance} assistance=${metrics.assistance}`);
  }

  console.log(`Recalculated ${count} commit(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
