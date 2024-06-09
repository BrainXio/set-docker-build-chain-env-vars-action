import { getNextVersion } from './versioning.js';
import * as core from '@actions/core';

jest.mock('@actions/core');

describe('Versioning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default next version and reason when no latest tag', () => {
    const { nextVersion, versionBumpReason } = getNextVersion(null, '', '');

    expect(nextVersion).toBe('v0.0.1');
    expect(versionBumpReason).toBe('default');
  });

  it('calculates next version based on commit message', () => {
    const { nextVersion, versionBumpReason } = getNextVersion('v1.0.0', 'feature: add new feature', 'refs/heads/feature/test-feature');

    expect(nextVersion).toBe('v1.1.0');
    expect(versionBumpReason).toBe('commit message');
  });

  it('calculates next version based on branch name', () => {
    const { nextVersion, versionBumpReason } = getNextVersion('v1.0.0', 'some commit message', 'refs/heads/feature/test-feature');

    expect(nextVersion).toBe('v1.1.0');
    expect(versionBumpReason).toBe('branch name');
  });

  it('handles invalid release version', () => {
    core.setFailed = jest.fn();

    const { nextVersion, versionBumpReason } = getNextVersion('v1.0.0', 'some commit message', 'refs/heads/release/v0.9.0');

    expect(core.setFailed).toHaveBeenCalledWith('Invalid or non-incremental release version in branch name.');
    expect(nextVersion).toBe('v1.0.0'); // No change
    expect(versionBumpReason).toBe('default');
  });
});
