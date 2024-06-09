import * as core from '@actions/core';
import * as github from '@actions/github';
import { execSync } from 'child_process';

jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

import { main } from './index.js'; // Ensure this matches your main file's path

describe('GitHub Action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    github.context.repo = { repo: 'test-repo-container' };
    github.context.ref = 'refs/heads/feature/test-feature';
    github.context.eventName = 'push';
    github.context.sha = '1234567abcdef';
    github.context.runId = '1234';
    github.context.runNumber = '1';
    github.context.payload = {
      head_commit: {
        message: 'feature: add new feature',
      },
    };

    core.getInput = jest.fn((name) => {
      const inputs = {
        image_base: 'base/image',
        image_version: '1.0.0-base-123',
        artifact_suffix: 'suffix',
        prefix: 'test-prefix',
      };
      return inputs[name];
    });
  });

  it('sets the correct environment variables when no tags are present', () => {
    execSync.mockImplementation((command) => {
      if (command.includes('git describe --tags --abbrev=0')) {
        throw new Error('Command failed');
      }
      return '';
    });

    main();

    const expectedCalls = [
      ['APP_NAME', 'test-repo'],
      ['SAFE_IMAGE_BASE', 'base-image'],
      ['BUILDER_IMAGE_VERSION', '1.0.0-devel-123'],
      ['BUILD_ID', '1234567-1234-1-1-feature-test-feature-base-image-1.0.0-devel-123'],
      ['BUILDER_ID', 'test-prefix-1234567-1234-1-1-feature-test-feature-base-image-1.0.0-devel-123'],
      ['ARTIFACT_DIR', expect.stringMatching(/^artifacts\/\d{4}-\d{2}-\d{2}\/1234\/base-image\/1.0.0-devel-123\/suffix$/)],
      ['CURRENT_VERSION', 'v0.0.0'],
      ['NEXT_VERSION', 'v0.0.1'],
      ['VERSION_BUMP_REASON', 'default'],
    ];

    console.log(core.exportVariable.mock.calls);

    expectedCalls.forEach((call, index) => {
      console.log(`Checking call ${index + 1}: ${JSON.stringify(call)}`);
      expect(core.exportVariable).toHaveBeenNthCalledWith(index + 1, ...call);
    });
    expect(core.setOutput).toHaveBeenCalledWith('NEXT_VERSION', 'v0.0.1');
  });

  it('sets the correct environment variables with tags present', () => {
    execSync.mockReturnValue('v1.0.0');

    main();

    const expectedCalls = [
      ['APP_NAME', 'test-repo'],
      ['SAFE_IMAGE_BASE', 'base-image'],
      ['BUILDER_IMAGE_VERSION', '1.0.0-devel-123'],
      ['BUILD_ID', '1234567-1234-1-1-feature-test-feature-base-image-1.0.0-devel-123'],
      ['BUILDER_ID', 'test-prefix-1234567-1234-1-1-feature-test-feature-base-image-1.0.0-devel-123'],
      ['ARTIFACT_DIR', expect.stringMatching(/^artifacts\/\d{4}-\d{2}-\d{2}\/1234\/base-image\/1.0.0-devel-123\/suffix$/)],
      ['CURRENT_VERSION', 'v1.0.0'],
      ['NEXT_VERSION', 'v1.1.0'],
      ['VERSION_BUMP_REASON', 'commit message'],
    ];

    console.log(core.exportVariable.mock.calls);

    expectedCalls.forEach((call, index) => {
      console.log(`Checking call ${index + 1}: ${JSON.stringify(call)}`);
      expect(core.exportVariable).toHaveBeenNthCalledWith(index + 1, ...call);
    });
    expect(core.setOutput).toHaveBeenCalledWith('NEXT_VERSION', 'v1.1.0');
  });

  it('handles missing repository name', () => {
    delete github.context.repo.repo;

    main();

    expect(core.setFailed).toHaveBeenCalledWith('Action failed with error: Repository name is not available in the GitHub context.');
  });

  it('handles command failures gracefully', () => {
    execSync.mockImplementation(() => {
      throw new Error('Command failed');
    });

    main();

    expect(core.info).toHaveBeenCalledWith('Command failed: git describe --tags --abbrev=0');
    expect(core.exportVariable).toHaveBeenCalledWith('CURRENT_VERSION', 'v0.0.0');
    expect(core.exportVariable).toHaveBeenCalledWith('NEXT_VERSION', 'v0.0.1');
    expect(core.exportVariable).toHaveBeenCalledWith('VERSION_BUMP_REASON', 'default');
    expect(core.setOutput).toHaveBeenCalledWith('NEXT_VERSION', 'v0.0.1');
  });
});
