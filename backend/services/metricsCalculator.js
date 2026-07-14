const REWORK_DAYS = 21;

function wsNormalize(line) {
  return line.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/g, '');
}

// LCS-based opcode diff, equivalent in shape to Python difflib's get_opcodes():
// returns [tag, i1, i2, j1, j2] with tag in equal | replace | delete | insert.
function computeOpcodes(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const raw = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      raw.push('equal');
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push('delete');
      i++;
    } else {
      raw.push('insert');
      j++;
    }
  }
  while (i < n) {
    raw.push('delete');
    i++;
  }
  while (j < m) {
    raw.push('insert');
    j++;
  }

  const opcodes = [];
  let ii = 0;
  let jj = 0;
  let k = 0;
  while (k < raw.length) {
    if (raw[k] === 'equal') {
      let count = 0;
      while (k < raw.length && raw[k] === 'equal') {
        count++;
        k++;
      }
      opcodes.push(['equal', ii, ii + count, jj, jj + count]);
      ii += count;
      jj += count;
    } else {
      let delCount = 0;
      let insCount = 0;
      while (k < raw.length && raw[k] !== 'equal') {
        if (raw[k] === 'delete') delCount++;
        else insCount++;
        k++;
      }
      const tag = delCount && insCount ? 'replace' : delCount ? 'delete' : 'insert';
      opcodes.push([tag, ii, ii + delCount, jj, jj + insCount]);
      ii += delCount;
      jj += insCount;
    }
  }
  return opcodes;
}

function computeNewWork(status, oldLines, newLines) {
  if (status === 'removed') return 0;

  if (status === 'added') {
    return newLines.filter((line) => line.trim() !== '').length;
  }

  const oldNorm = oldLines.map(wsNormalize);
  const newNorm = newLines.map(wsNormalize);
  const opcodes = computeOpcodes(oldNorm, newNorm);

  let newwork = 0;
  for (const [tag, , , j1, j2] of opcodes) {
    if (tag === 'insert' || tag === 'replace') {
      for (let j = j1; j < j2; j++) {
        if (newLines[j].trim() !== '') newwork++;
      }
    }
  }
  return newwork;
}

// parentBlame/currentBlame: { [lineNo]: { author: string, date: Date|null } }, 0-indexed.
function classifyRemovedLines({
  status,
  oldLines,
  newLines,
  parentBlame,
  currentBlame,
  commitAuthorEmail,
  commitDate,
  linesRemoved,
  reworkDays = REWORK_DAYS,
}) {
  if (status === 'added' || status === 'removed') {
    return { rework: 0, assistance: 0, maintenance: 0 };
  }

  const currentMetrics = new Set();
  newLines.forEach((raw, lineNo) => {
    const stripped = raw.trim();
    if (stripped === '') return;
    const blameEntry = currentBlame[lineNo];
    if (!blameEntry) return;
    currentMetrics.add(`${stripped.toLowerCase()}::${blameEntry.author.toLowerCase()}`);
  });

  const available = new Set(currentMetrics);
  let rework = 0;
  let assistance = 0;
  let maintenance = 0;

  for (let lineNo = 0; lineNo < oldLines.length; lineNo++) {
    const raw = oldLines[lineNo];
    const content = status === 'modified' ? raw.trim() : raw;
    if (content.trim() === '') continue;

    const blameEntry = parentBlame[lineNo];
    if (!blameEntry) continue;
    const { author: lineAuthor, date: lineDate } = blameEntry;

    const key = `${content.toLowerCase()}::${lineAuthor.toLowerCase()}`;
    if (available.has(key)) {
      available.delete(key);
      continue;
    }

    if (lineDate == null) continue;

    const ageDays = Math.floor((commitDate.getTime() - lineDate.getTime()) / 86400000);

    if (lineAuthor.toLowerCase() === commitAuthorEmail.toLowerCase() && ageDays <= reworkDays) {
      rework++;
    } else if (ageDays <= reworkDays) {
      assistance++;
    } else {
      maintenance++;
    }

    if (rework + assistance + maintenance === linesRemoved) break;
  }

  return { rework, assistance, maintenance };
}

module.exports = { REWORK_DAYS, wsNormalize, computeOpcodes, computeNewWork, classifyRemovedLines };
