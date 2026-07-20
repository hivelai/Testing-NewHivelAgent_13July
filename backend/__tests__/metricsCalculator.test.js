const { wsNormalize, classifyChangedLines, calculateRatios, REWORK_DAYS } = require('../services/metricsCalculator');

describe('wsNormalize', () => {
  it('collapses runs of spaces/tabs into a single space', () => {
    expect(wsNormalize('foo   bar\tbaz')).toBe('foo bar baz');
  });

  it('strips trailing whitespace', () => {
    expect(wsNormalize('foo bar   ')).toBe('foo bar');
  });

  it('collapses a run of tabs into a single space', () => {
    expect(wsNormalize('foo\t\t\tbar')).toBe('foo bar');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(wsNormalize('   \t  ')).toBe('');
  });
});

describe('classifyChangedLines', () => {
  const commitDate = new Date('2026-07-01T00:00:00Z');
  const commitAuthorEmail = 'author@example.com';

  it('returns all zeros for a removed file', () => {
    expect(
      classifyChangedLines({
        status: 'removed',
        oldLines: ['a', 'b'],
        newLines: [],
        parentBlame: {},
        currentBlame: {},
        commitAuthorEmail,
        commitDate,
        linesRemoved: 2,
      })
    ).toEqual({ newwork: 0, rework: 0, assistance: 0, maintenance: 0 });
  });

  it('counts non-blank lines as newwork for an added file', () => {
    expect(
      classifyChangedLines({
        status: 'added',
        oldLines: [],
        newLines: ['line1', '', '  ', 'line2'],
        parentBlame: {},
        currentBlame: {},
        commitAuthorEmail,
        commitDate,
        linesRemoved: 0,
      })
    ).toEqual({ newwork: 2, rework: 0, assistance: 0, maintenance: 0 });
  });

  it('ignores pure whitespace-formatting changes in a modified file', () => {
    // git blame -w treats a whitespace-only edit as no real change, so both sides keep
    // the same original author — the key match below models that.
    const oldLines = ['const x = 1;', 'const y = 2;'];
    const newLines = ['const   x = 1;', 'const y = 2;   '];
    const parentBlame = {
      0: { author: 'other@example.com', date: commitDate },
      1: { author: 'other@example.com', date: commitDate },
    };
    const currentBlame = {
      0: { author: 'other@example.com', date: commitDate },
      1: { author: 'other@example.com', date: commitDate },
    };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame,
      commitAuthorEmail,
      commitDate,
      linesRemoved: 0,
    });

    expect(result).toEqual({ newwork: 0, rework: 0, assistance: 0, maintenance: 0 });
  });

  it('counts genuinely new lines in a modified file', () => {
    const oldLines = ['const x = 1;'];
    const newLines = ['const x = 1;', 'const y = 2;'];
    const parentBlame = { 0: { author: 'other@example.com', date: commitDate } };
    const currentBlame = {
      0: { author: 'other@example.com', date: commitDate },
      1: { author: commitAuthorEmail, date: commitDate },
    };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame,
      commitAuthorEmail,
      commitDate,
      linesRemoved: 0,
    });

    expect(result.newwork).toBe(1);
  });

  it('does not count blank inserted lines', () => {
    const oldLines = ['const x = 1;'];
    const newLines = ['const x = 1;', '', 'const y = 2;'];
    const parentBlame = { 0: { author: 'other@example.com', date: commitDate } };
    const currentBlame = {
      0: { author: 'other@example.com', date: commitDate },
      2: { author: commitAuthorEmail, date: commitDate },
    };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame,
      commitAuthorEmail,
      commitDate,
      linesRemoved: 0,
    });

    expect(result.newwork).toBe(1);
  });

  it('does not classify a line that was only moved within the file', () => {
    // Same content, same original author (as -M blame would report), different position —
    // this is the exact "line shift wrongly counted as rework" bug: it must be excluded
    // from newwork AND from rework/assistance/maintenance.
    const oldLines = ['function one() {}', 'function two() {}', 'function three() {}'];
    const newLines = ['function one() {}', 'function three() {}', 'function two() {}'];
    const parentBlame = {
      0: { author: 'alice@example.com', date: commitDate },
      1: { author: 'alice@example.com', date: commitDate },
      2: { author: 'alice@example.com', date: commitDate },
    };
    const currentBlame = {
      0: { author: 'alice@example.com', date: commitDate },
      1: { author: 'alice@example.com', date: commitDate }, // moved, blame -M preserves original author
      2: { author: 'alice@example.com', date: commitDate },
    };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame,
      commitAuthorEmail: 'bob@example.com',
      commitDate,
      linesRemoved: 0,
    });

    expect(result).toEqual({ newwork: 0, rework: 0, assistance: 0, maintenance: 0 });
  });

  it('forgives a removed line whose content+author still exists in the new file', () => {
    const oldLines = ['const shared = 1;'];
    const newLines = ['const shared = 1;'];
    const parentBlame = { 0: { author: 'other@example.com', date: commitDate } };
    const currentBlame = { 0: { author: 'other@example.com', date: commitDate } };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame,
      commitAuthorEmail,
      commitDate,
      linesRemoved: 0,
    });

    expect(result).toEqual({ newwork: 0, rework: 0, assistance: 0, maintenance: 0 });
  });

  it('classifies a recently self-authored removed line as rework', () => {
    const oldLines = ['const gone = 1;'];
    const newLines = [];
    const recentDate = new Date(commitDate.getTime() - 5 * 86400000); // 5 days old
    const parentBlame = { 0: { author: commitAuthorEmail, date: recentDate } };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame: {},
      commitAuthorEmail,
      commitDate,
      linesRemoved: 1,
    });

    expect(result).toEqual({ newwork: 0, rework: 1, assistance: 0, maintenance: 0 });
  });

  it('classifies a recently other-authored removed line as assistance', () => {
    const oldLines = ['const gone = 1;'];
    const newLines = [];
    const recentDate = new Date(commitDate.getTime() - 5 * 86400000);
    const parentBlame = { 0: { author: 'other@example.com', date: recentDate } };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame: {},
      commitAuthorEmail,
      commitDate,
      linesRemoved: 1,
    });

    expect(result).toEqual({ newwork: 0, rework: 0, assistance: 1, maintenance: 0 });
  });

  it('classifies an old removed line (any author) as maintenance', () => {
    const oldLines = ['const gone = 1;'];
    const newLines = [];
    const oldDate = new Date(commitDate.getTime() - (REWORK_DAYS + 10) * 86400000);
    const parentBlame = { 0: { author: commitAuthorEmail, date: oldDate } };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame: {},
      commitAuthorEmail,
      commitDate,
      linesRemoved: 1,
    });

    expect(result).toEqual({ newwork: 0, rework: 0, assistance: 0, maintenance: 1 });
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

    const result = classifyChangedLines({
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

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame: {},
      commitAuthorEmail,
      commitDate,
      linesRemoved: 1,
    });

    expect(result).toEqual({ newwork: 0, rework: 0, assistance: 0, maintenance: 1 });
  });

  it('treats a line exactly REWORK_DAYS old as still within the rework window', () => {
    const oldLines = ['const gone = 1;'];
    const newLines = [];
    const boundaryDate = new Date(commitDate.getTime() - REWORK_DAYS * 86400000);
    const parentBlame = { 0: { author: commitAuthorEmail, date: boundaryDate } };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame: {},
      commitAuthorEmail,
      commitDate,
      linesRemoved: 1,
    });

    expect(result).toEqual({ newwork: 0, rework: 1, assistance: 0, maintenance: 0 });
  });

  it('treats a line one day past REWORK_DAYS as maintenance', () => {
    const oldLines = ['const gone = 1;'];
    const newLines = [];
    const boundaryDate = new Date(commitDate.getTime() - (REWORK_DAYS + 1) * 86400000);
    const parentBlame = { 0: { author: commitAuthorEmail, date: boundaryDate } };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame: {},
      commitAuthorEmail,
      commitDate,
      linesRemoved: 1,
    });

    expect(result).toEqual({ newwork: 0, rework: 0, assistance: 0, maintenance: 1 });
  });

  it('honors a custom reworkDays override instead of the default REWORK_DAYS', () => {
    const oldLines = ['const gone = 1;'];
    const newLines = [];
    const sixDaysOld = new Date(commitDate.getTime() - 6 * 86400000);
    const parentBlame = { 0: { author: commitAuthorEmail, date: sixDaysOld } };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame: {},
      commitAuthorEmail,
      commitDate,
      linesRemoved: 1,
      reworkDays: 5,
    });

    expect(result).toEqual({ newwork: 0, rework: 0, assistance: 0, maintenance: 1 });
  });

  it('compares commit author and line author case-insensitively', () => {
    const oldLines = ['const gone = 1;'];
    const newLines = [];
    const recentDate = new Date(commitDate.getTime() - 5 * 86400000);
    const parentBlame = { 0: { author: 'Author@Example.COM', date: recentDate } };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame: {},
      commitAuthorEmail: 'author@example.com',
      commitDate,
      linesRemoved: 1,
    });

    expect(result).toEqual({ newwork: 0, rework: 1, assistance: 0, maintenance: 0 });
  });

  it('skips a removed line entirely when its blame entry has no date', () => {
    const oldLines = ['const gone = 1;'];
    const newLines = [];
    const parentBlame = { 0: { author: commitAuthorEmail, date: null } };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame: {},
      commitAuthorEmail,
      commitDate,
      linesRemoved: 1,
    });

    expect(result).toEqual({ newwork: 0, rework: 0, assistance: 0, maintenance: 0 });
  });

  it('does not count an added line as newwork when it has no currentBlame entry', () => {
    const oldLines = ['const x = 1;'];
    const newLines = ['const x = 1;', 'const y = 2;'];
    const parentBlame = { 0: { author: 'other@example.com', date: commitDate } };
    const currentBlame = { 0: { author: 'other@example.com', date: commitDate } };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame,
      commitAuthorEmail,
      commitDate,
      linesRemoved: 0,
    });

    expect(result.newwork).toBe(0);
  });

  it('only excuses as many duplicate lines as actually reappear elsewhere', () => {
    // Two identical old lines but only one copy survives in the new file: exactly one
    // should be treated as "moved" (excluded), the other must still be classified as removed.
    const oldLines = ['const dup = 1;', 'const dup = 1;'];
    const newLines = ['const dup = 1;'];
    const oldDate = new Date(commitDate.getTime() - (REWORK_DAYS + 10) * 86400000);
    const parentBlame = {
      0: { author: 'alice@example.com', date: oldDate },
      1: { author: 'alice@example.com', date: oldDate },
    };
    const currentBlame = { 0: { author: 'alice@example.com', date: oldDate } };

    const result = classifyChangedLines({
      status: 'modified',
      oldLines,
      newLines,
      parentBlame,
      currentBlame,
      commitAuthorEmail: 'bob@example.com',
      commitDate,
      linesRemoved: 1,
    });

    expect(result).toEqual({ newwork: 0, rework: 0, assistance: 0, maintenance: 1 });
  });
});

describe('calculateRatios', () => {
  it('returns all zero ratios when there are no classified lines', () => {
    expect(calculateRatios({ newwork: 0, rework: 0, assistance: 0, maintenance: 0 })).toEqual({
      newworkRatio: 0,
      reworkRatio: 0,
      assistanceRatio: 0,
      maintenanceRatio: 0,
    });
  });

  it('defaults missing counts to zero', () => {
    expect(calculateRatios({})).toEqual({
      newworkRatio: 0,
      reworkRatio: 0,
      assistanceRatio: 0,
      maintenanceRatio: 0,
    });
  });

  it('computes each bucket as a share of the total', () => {
    const result = calculateRatios({ newwork: 6, rework: 2, assistance: 1, maintenance: 1 });

    expect(result).toEqual({
      newworkRatio: 0.6,
      reworkRatio: 0.2,
      assistanceRatio: 0.1,
      maintenanceRatio: 0.1,
    });
  });

  it('gives a ratio of 1 to the only non-zero bucket', () => {
    expect(calculateRatios({ newwork: 0, rework: 5, assistance: 0, maintenance: 0 })).toEqual({
      newworkRatio: 0,
      reworkRatio: 1,
      assistanceRatio: 0,
      maintenanceRatio: 0,
    });
  });

  it('produces ratios that sum to 1 for any non-zero total', () => {
    const result = calculateRatios({ newwork: 3, rework: 4, assistance: 5, maintenance: 1 });
    const sum = result.newworkRatio + result.reworkRatio + result.assistanceRatio + result.maintenanceRatio;

    expect(sum).toBeCloseTo(1);
  });
});
