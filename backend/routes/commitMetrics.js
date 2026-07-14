const express = require('express');
const CommitMetric = require('../models/CommitMetric');
const { computeCommitMetrics, computeAllCommitsMetrics } = require('../services/gitCommitMetrics');

const router = express.Router();

function toCommitMetricDoc(repo, metrics) {
  return {
    repo,
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
  };
}

// POST analyze a commit (via local git repo checkout) and persist its metrics
router.post('/analyze', async (req, res) => {
  const { repoPath, repo, commitSha, parentSha } = req.body;
  if (!repoPath || !commitSha) {
    return res.status(400).json({ message: 'repoPath and commitSha are required' });
  }

  try {
    const metrics = await computeCommitMetrics(repoPath, commitSha, parentSha);
    const saved = await CommitMetric.findOneAndUpdate(
      { repo: repo || repoPath, commitSha },
      toCommitMetricDoc(repo || repoPath, metrics),
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST recompute metrics for every commit in the repo's history and upsert each row
router.post('/recalculate-all', async (req, res) => {
  const { repoPath, repo, ref } = req.body;
  if (!repoPath) {
    return res.status(400).json({ message: 'repoPath is required' });
  }

  try {
    const allMetrics = await computeAllCommitsMetrics(repoPath, ref);
    const resolvedRepo = repo || repoPath;

    const results = await Promise.all(
      allMetrics.map((metrics) =>
        CommitMetric.findOneAndUpdate(
          { repo: resolvedRepo, commitSha: metrics.commitSha },
          toCommitMetricDoc(resolvedRepo, metrics),
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      )
    );

    res.status(200).json({ recalculated: results.length, commits: results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET stored metrics for a commit
router.get('/:commitSha', async (req, res) => {
  const metric = await CommitMetric.findOne({ commitSha: req.params.commitSha });
  if (!metric) return res.status(404).json({ message: 'Metric not found' });
  res.json(metric);
});

module.exports = router;
