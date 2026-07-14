const mongoose = require('mongoose');

const commitMetricSchema = new mongoose.Schema(
  {
    repo: { type: String, required: true },
    commitSha: { type: String, required: true },
    parentSha: { type: String },
    authorEmail: { type: String },
    commitDate: { type: Date },
    rework: { type: Number, default: 0 },
    newwork: { type: Number, default: 0 },
    maintenance: { type: Number, default: 0 },
    assistance: { type: Number, default: 0 },
    linesAdded: { type: Number, default: 0 },
    linesRemoved: { type: Number, default: 0 },
  },
  { timestamps: true }
);

commitMetricSchema.index({ repo: 1, commitSha: 1 }, { unique: true });

module.exports = mongoose.model('CommitMetric', commitMetricSchema);
