const REWORK_DAYS = 21;

function wsNormalize(line) {
  return line.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/g, '');
}

// Builds a content+author key for a non-blank line, or null for a blank/unblamed line.
// The blame author is part of the key so that a line is only recognized as "moved" when
// the exact same historical line (same content, same original author) reappears elsewhere —
// not merely when some other line happens to share its text.
function lineKey(raw, blameEntry) {
  const stripped = wsNormalize(raw.trim());
  if (stripped === '' || !blameEntry) return null;
  return `${stripped.toLowerCase()}::${blameEntry.author.toLowerCase()}`;
}

function buildKeyCounts(lines, blame) {
  const counts = new Map();
  lines.forEach((raw, lineNo) => {
    const key = lineKey(raw, blame[lineNo]);
    if (key === null) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

// Classifies every changed line in a file into New Work / Rework / Assistance / Maintenance.
//
// A line that was only moved within the file — its normalized content and original blame
// author both reappear on the other side of the diff — is excluded from every bucket: it
// was neither truly removed nor truly added, so counting it as newwork (added side) or as
// rework/assistance/maintenance (removed side) would double-count a no-op edit.
function classifyChangedLines({
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
  if (status === 'removed') {
    return { newwork: 0, rework: 0, assistance: 0, maintenance: 0 };
  }

  if (status === 'added') {
    return { newwork: newLines.filter((line) => line.trim() !== '').length, rework: 0, assistance: 0, maintenance: 0 };
  }

  const availableInNew = buildKeyCounts(newLines, currentBlame);
  const availableInOld = buildKeyCounts(oldLines, parentBlame);

  let rework = 0;
  let assistance = 0;
  let maintenance = 0;

  for (let lineNo = 0; lineNo < oldLines.length; lineNo++) {
    const blameEntry = parentBlame[lineNo];
    const key = lineKey(oldLines[lineNo], blameEntry);
    if (key === null) continue;

    const remaining = availableInNew.get(key) || 0;
    if (remaining > 0) {
      availableInNew.set(key, remaining - 1);
      continue; // still present elsewhere in the new file: moved, not removed
    }

    const { author: lineAuthor, date: lineDate } = blameEntry;
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

  let newwork = 0;

  for (let lineNo = 0; lineNo < newLines.length; lineNo++) {
    const blameEntry = currentBlame[lineNo];
    const key = lineKey(newLines[lineNo], blameEntry);
    if (key === null) continue;

    const remaining = availableInOld.get(key) || 0;
    if (remaining > 0) {
      availableInOld.set(key, remaining - 1);
      continue; // already present in the old file: unchanged or moved, not new
    }

    newwork++;
  }

  return { newwork, rework, assistance, maintenance };
}

// Turns raw New Work / Rework / Assistance / Maintenance counts into their share of the
// total classified lines, for use in summaries and charts. Returns all zeros when there's
// nothing classified, rather than dividing by zero.
function calculateRatios({ newwork = 0, rework = 0, assistance = 0, maintenance = 0 } = {}) {
  const total = newwork + rework + assistance + maintenance;
  if (total === 0) {
    return { newworkRatio: 0, reworkRatio: 0, assistanceRatio: 0, maintenanceRatio: 0 };
  }

  return {
    newworkRatio: newwork / total,
    reworkRatio: rework / total,
    assistanceRatio: assistance / total,
    maintenanceRatio: maintenance / total,
  };
}

module.exports = { REWORK_DAYS, wsNormalize, classifyChangedLines, calculateRatios };
