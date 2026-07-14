const { wsNormalize, computeNewWork, classifyRemovedLines, REWORK_DAYS } = require('../services/metricsCalculator');

describe('wsNormalize', () => {
  it('collapses runs of spaces/tabs into a single space', () => {
    expect(wsNormalize('foo   bar\tbaz')).toBe('foo bar baz');
  });

  it('strips trailing whitespace', () => {
    expect(wsNormalize('foo bar   ')).toBe('foo bar');
  });
});

describe('computeNewWork', () => {
  it('is 0 for a removed file', () => {
    expect(computeNewWork('removed', ['a', 'b'], [])).toBe(0);
  });

  it('counts non-blank lines for an added file', () => {
    expect(computeNewWork('added', [], ['line1', '', '  ', 'line2'])).toBe(2);
  });

  it('ignores pure whitespace-formatting changes in a modified file', () => {
    const oldLines = ['const x = 1;', 'const y = 2;'];
    const newLines = ['const   x = 1;', 'const y = 2;   '];
    expect(computeNewWork('modified', oldLines, newLines)).toBe(0);
  });

  it('counts genuinely new lines in a modified file', () => {
    const oldLines = ['const x = 1;'];
    const newLines = ['const x = 1;', 'const y = 2;'];
    expect(computeNewWork('modified', oldLines, newLines)).toBe(1);
  });

  it('does not count blank inserted lines', () => {
    const oldLines = ['const x = 1;'];
    const newLines = ['const x = 1;', '', 'const y = 2;'];
    expect(computeNewWork('modified', oldLines, newLines)).toBe(1);
  });
});

describe('classifyRemovedLines', () => {
  const commitDate = new Date('2026-07-01T00:00:00Z');
  const commitAuthorEmail = 'author@example.com';

  it('returns all zeros for added/removed files', () => {
    expect(
      classifyRemovedLines({
        status: 'added',
        oldLines: [],
        newLines: [],
        parentBlame: {},
        currentBlame: {},
        commitAuthorEmail,
        commitDate,
        linesRemoved: 0,
      })
    ).toEqual({ rework: 0, assistance: 0, maintenance: 0 });
  });

  it('forgives a removed line whose content+author still exists in the new file', () => {
    const oldLines = ['const shared = 1;'];
    const newLines = ['const shared = 1;'];
    const parentBlame = { 0: { author: 'other@example.com', date: commitDate } };
    const currentBlame = { 0: { author: 'other@example.com', date: commitDate } };

    const result = classifyRemovedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame,
      commitAuthorEmail,
      commitDate,
      linesRemoved: 0,
    });

    expect(result).toEqual({ rework: 0, assistance: 0, maintenance: 0 });
  });

  it('classifies a recently self-authored removed line as rework', () => {
    const oldLines = ['const gone = 1;'];
    const newLines = [];
    const recentDate = new Date(commitDate.getTime() - 5 * 86400000); // 5 days old
    const parentBlame = { 0: { author: commitAuthorEmail, date: recentDate } };

    const result = classifyRemovedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame: {},
      commitAuthorEmail,
      commitDate,
      linesRemoved: 1,
    });

    expect(result).toEqual({ rework: 1, assistance: 0, maintenance: 0 });
  });

  it('classifies a recently other-authored removed line as assistance', () => {
    const oldLines = ['const gone = 1;'];
    const newLines = [];
    const recentDate = new Date(commitDate.getTime() - 5 * 86400000);
    const parentBlame = { 0: { author: 'other@example.com', date: recentDate } };

    const result = classifyRemovedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame: {},
      commitAuthorEmail,
      commitDate,
      linesRemoved: 1,
    });

    expect(result).toEqual({ rework: 0, assistance: 1, maintenance: 0 });
  });

  it('classifies an old removed line (any author) as maintenance', () => {
    const oldLines = ['const gone = 1;'];
    const newLines = [];
    const oldDate = new Date(commitDate.getTime() - (REWORK_DAYS + 10) * 86400000);
    const parentBlame = { 0: { author: commitAuthorEmail, date: oldDate } };

    const result = classifyRemovedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame: {},
      commitAuthorEmail,
      commitDate,
      linesRemoved: 1,
    });

    expect(result).toEqual({ rework: 0, assistance: 0, maintenance: 1 });
  });

  it('stops classifying once linesRemoved count is reached', () => {
    const oldLines = ['const a = 1;', 'const b = 2;', 'const c = 3;'];
    const newLines = [];
    const oldDate = new Date(commitDate.getTime() - (REWORK_DAYS + 10) * 86400000);
    const parentBlame = {
      0: { author: commitAuthorEmail, date: oldDate },
      1: { author: commitAuthorEmail, date: oldDate },
      2: { author: commitAuthorEmail, date: oldDate },
    };

    const result = classifyRemovedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame: {},
      commitAuthorEmail,
      commitDate,
      linesRemoved: 2,
    });

    expect(result.maintenance).toBe(2);
  });

  it('skips blank old lines without classifying them', () => {
    const oldLines = ['', 'const gone = 1;'];
    const newLines = [];
    const oldDate = new Date(commitDate.getTime() - (REWORK_DAYS + 10) * 86400000);
    const parentBlame = { 1: { author: commitAuthorEmail, date: oldDate } };

    const result = classifyRemovedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame: {},
      commitAuthorEmail,
      commitDate,
      linesRemoved: 1,
    });

    expect(result).toEqual({ rework: 0, assistance: 0, maintenance: 1 });
  });
});
