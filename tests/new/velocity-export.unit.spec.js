'use strict';

jest.mock('better-sqlite3', () =>
  jest.fn().mockImplementation(() => ({
    prepare: () => ({ all: () => [] }),
    close: () => {},
  }))
);

const fs = require('fs');
const { exportCSV, isMainCheckout } = require('../../scripts/velocity-export');

describe('isMainCheckout()', () => {
  afterEach(() => jest.restoreAllMocks());

  test('returns true when .git is a directory (main checkout)', () => {
    jest.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true });
    expect(isMainCheckout()).toBe(true);
  });

  test('returns false when .git is a file (worktree)', () => {
    jest.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => false });
    expect(isMainCheckout()).toBe(false);
  });

  test('returns false when .git does not exist', () => {
    jest.spyOn(fs, 'statSync').mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    expect(isMainCheckout()).toBe(false);
  });
});

describe('exportCSV() main-checkout guard', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(fs, 'renameSync').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('skips CSV write and prints notice when running from main checkout', () => {
    jest.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true });
    const writeSpy = jest.spyOn(fs, 'writeFileSync');

    exportCSV();

    expect(writeSpy).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Skipping CSV export'));
  });

  test('proceeds past guard when force=true even on main checkout', () => {
    jest.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true });
    const writeSpy = jest.spyOn(fs, 'writeFileSync');

    exportCSV({ force: true });

    expect(writeSpy).toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Skipping CSV export'));
  });

  test('proceeds normally when running from a worktree', () => {
    jest.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => false });
    const writeSpy = jest.spyOn(fs, 'writeFileSync');

    exportCSV();

    expect(writeSpy).toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Skipping CSV export'));
  });
});
