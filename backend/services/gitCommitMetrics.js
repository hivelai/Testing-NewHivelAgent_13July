const { execFileSync } = require('child_process');
const { classifyChangedLines, calculateRatios } = require('./metricsCalculator');

function git(repoPath, args) {
  return execFileSync('git', args, {
    cwd: repoPath,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function splitLines(text) {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function getCommitMeta(repoPath, commitSha) {
  const out = git(repoPath, ['show', '-s', '--format=%ae%n%cI', commitSha]);
  const [authorEmail, commitDateIso] = out.trim().split('\n');
  return { authorEmail, commitDate: new Date(commitDateIso) };
}

function getParentSha(repoPath, commitSha) {
  try {
    return git(repoPath, ['rev-parse', `${commitSha}^`]).trim();
  } catch {
    return null; // root commit has no parent
  }
}

// Parses `git diff-tree -r -M --raw -z` and `--numstat -z` output (aligned by file order)
// into a unified list of { status, oldPath, newPath, additions, deletions }.
function listChangedFiles(repoPath, parentSha, commitSha) {
  const rawOut = git(repoPath, ['diff-tree', '-r', '--no-commit-id', '-M', '--raw', '-z', parentSha, commitSha]);
  const numstatOut = git(repoPath, ['diff-tree', '-r', '--no-commit-id', '-M', '--numstat', '-z', parentSha, commitSha]);

  const rawTokens = rawOut.split('\0').filter((t) => t !== '');
  const numstatTokens = numstatOut.split('\0').filter((t) => t !== '');

  const entries = [];
  let ri = 0;
  while (ri < rawTokens.length) {
    const header = rawTokens[ri++];
    const statusChar = header.split(' ').pop().trim()[0];
    const isRenameOrCopy = statusChar === 'R' || statusChar === 'C';
    const oldPath = rawTokens[ri++];
    const newPath = isRenameOrCopy ? rawTokens[ri++] : oldPath;

    const status = statusChar === 'A' ? 'added' : statusChar === 'D' ? 'removed' : statusChar === 'R' ? 'renamed' : 'modified';

    entries.push({ status, oldPath, newPath });
  }

  // Each NUL-delimited numstat record is itself "added\tdeleted\tpath[\tpath2]" (tab-joined),
  // not one field per NUL token. Records line up 1:1 with `entries` in the same file order.
  entries.forEach((entry, idx) => {
    const [added, deleted] = numstatTokens[idx].split('\t');
    entry.additions = parseInt(added, 10) || 0;
    entry.deletions = deleted === '-' ? 0 : parseInt(deleted, 10) || 0;
  });

  return entries;
}

function getFileContent(repoPath, commitSha, filePath) {
  try {
    return splitLines(git(repoPath, ['show', `${commitSha}:${filePath}`]));
  } catch {
    return [];
  }
}

// Returns { [lineNo]: { author, date } }, 0-indexed, or null if blame is unavailable.
function getBlame(repoPath, commitSha, filePath) {
  let out;
  try {
    out = git(repoPath, ['blame', '-w', '-M', '--line-porcelain', commitSha, '--', filePath]);
  } catch {
    return null;
  }

  const blame = {};
  let lineNo = 0;
  let currentAuthorMail = null;
  let currentCommitterTime = null;

  for (const line of out.split('\n')) {
    if (line.startsWith('author-mail ')) {
      currentAuthorMail = line.slice('author-mail '.length).trim().replace(/^<|>$/g, '');
    } else if (line.startsWith('committer-time ')) {
      currentCommitterTime = parseInt(line.slice('committer-time '.length).trim(), 10);
    } else if (line.startsWith('\t')) {
      blame[lineNo] = {
        author: currentAuthorMail || '',
        date: currentCommitterTime ? new Date(currentCommitterTime * 1000) : null,
      };
      lineNo++;
    }
  }

  return blame;
}

function listCommitShas(repoPath, ref = 'HEAD') {
  const out = git(repoPath, ['log', '--format=%H', '--reverse', ref]);
  return splitLines(out);
}

async function computeAllCommitsMetrics(repoPath, ref = 'HEAD') {
  const shas = listCommitShas(repoPath, ref);
  const results = [];
  for (const sha of shas) {
    results.push(await computeCommitMetrics(repoPath, sha));
  }
  return results;
}

async function computeCommitMetrics(repoPath, commitSha, parentShaInput) {
  const parentSha = parentShaInput || getParentSha(repoPath, commitSha);
  const { authorEmail, commitDate } = getCommitMeta(repoPath, commitSha);

  if (!parentSha) {
    return {
      commitSha,
      parentSha: null,
      authorEmail,
      commitDate,
      files: [],
      rework: 0,
      newwork: 0,
      maintenance: 0,
      assistance: 0,
      linesAdded: 0,
      linesRemoved: 0,
      ...calculateRatios({}),
    };
  }

  const changedFiles = listChangedFiles(repoPath, parentSha, commitSha);

  const totals = { rework: 0, newwork: 0, maintenance: 0, assistance: 0, linesAdded: 0, linesRemoved: 0 };
  const files = [];

  for (const file of changedFiles) {
    totals.linesAdded += file.additions;
    totals.linesRemoved += file.deletions;

    let fileMetrics;
    try {
      const oldLines = file.status === 'added' ? [] : getFileContent(repoPath, parentSha, file.oldPath);
      const newLines = file.status === 'removed' ? [] : getFileContent(repoPath, commitSha, file.newPath);
      const parentBlame = file.status === 'added' ? {} : getBlame(repoPath, parentSha, file.oldPath);
      const currentBlame = file.status === 'removed' ? {} : getBlame(repoPath, commitSha, file.newPath);

      if (parentBlame === null || currentBlame === null) {
        fileMetrics = { rework: 0, newwork: 0, maintenance: 0, assistance: 0 };
      } else {
        fileMetrics = classifyChangedLines({
          status: file.status,
          oldLines,
          newLines,
          parentBlame,
          currentBlame,
          commitAuthorEmail: authorEmail,
          commitDate,
          linesRemoved: file.deletions,
        });
      }
    } catch {
      fileMetrics = { rework: 0, newwork: 0, maintenance: 0, assistance: 0 };
    }

    totals.rework += fileMetrics.rework;
    totals.newwork += fileMetrics.newwork;
    totals.maintenance += fileMetrics.maintenance;
    totals.assistance += fileMetrics.assistance;

    files.push({ path: file.newPath, oldPath: file.oldPath, status: file.status, additions: file.additions, deletions: file.deletions, ...fileMetrics });
  }

  return { commitSha, parentSha, authorEmail, commitDate, files, ...totals, ...calculateRatios(totals) };
}

module.exports = {
  computeCommitMetrics,
  computeAllCommitsMetrics,
  listCommitShas,
  listChangedFiles,
  getFileContent,
  getBlame,
  getCommitMeta,
  getParentSha,
};
