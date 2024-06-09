import * as core from '@actions/core';
import * as github from '@actions/github';
import { runCommand, getNextVersion } from './versioning.js';

export function setEnvironmentVariable(name, value) {
  core.exportVariable(name, value);
  core.info(`${name}: ${value}`);
}

export function main() {
  try {
    // Ensure required inputs are provided
    const imageBase = core.getInput('image_base', { required: true });
    const imageVersion = core.getInput('image_version', { required: true });
    const artifactSuffix = core.getInput('artifact_suffix', { required: true });

    // Set APP_NAME
    const repo = github.context.repo.repo;
    if (!repo) throw new Error('Repository name is not available in the GitHub context.');
    const appName = repo.replace('-container', '').toLowerCase();
    setEnvironmentVariable('APP_NAME', appName);

    // Set SAFE_IMAGE_BASE
    const safeImageBase = imageBase.replace(/\//g, '-').replace(/-$/, '');
    setEnvironmentVariable('SAFE_IMAGE_BASE', safeImageBase);

    // Set BUILDER_IMAGE_VERSION
    const ref = github.context.ref;
    const eventName = github.context.eventName;
    let builderImageVersion;

    if (ref.startsWith('refs/heads/feature/')) {
      builderImageVersion = imageVersion.replace('-base-', '-devel-');
    } else if (
      eventName === 'pull_request' &&
      (github.context.payload.pull_request.head.ref.startsWith('hotfix/') ||
        github.context.payload.pull_request.head.ref.startsWith('bugfix/') ||
        github.context.payload.pull_request.head.ref.startsWith('release/'))
    ) {
      builderImageVersion = imageVersion.replace('-base-', '-runtime-');
    } else {
      builderImageVersion = imageVersion;
    }
    setEnvironmentVariable('BUILDER_IMAGE_VERSION', builderImageVersion);

    // Use the branch directly from the context
    const branch = ref.replace('refs/heads/', '').replace(/\//g, '-').toLowerCase();
    core.info(`Branch: ${branch}`);

    // Use runAttempt or provide a default value
    const runAttempt = github.context.runAttempt || '1';
    core.info(`Run Attempt: ${runAttempt}`);

    // Set BUILD_ID
    const shortSha = github.context.sha.substring(0, 7);
    const imageTag = `${shortSha}-${github.context.runId}-${github.context.runNumber}-${runAttempt}-${branch}-${safeImageBase}-${builderImageVersion}`;
    setEnvironmentVariable('BUILD_ID', imageTag);

    // Set BUILDER_ID
    const prefix = core.getInput('prefix');
    const builderId = prefix ? `${prefix}-${imageTag}` : imageTag;
    setEnvironmentVariable('BUILDER_ID', builderId);

    // Set ARTIFACT_DIR
    const artifactDir = `artifacts/${new Date().toISOString().split('T')[0]}/${github.context.runId}/${safeImageBase}/${builderImageVersion}/${artifactSuffix}`;
    setEnvironmentVariable('ARTIFACT_DIR', artifactDir);

    // Create Artifact Storage
    runCommand(`mkdir -p ${artifactDir}`);
    core.info(`Artifact storage created at ${artifactDir}`);

    // Determine CURRENT_VERSION and NEXT_VERSION
    let latestTag;
    let currentVersion = 'v0.0.0'; // Default version if no tags are found
    try {
      latestTag = runCommand('git describe --tags --abbrev=0');
      if (latestTag) {
        core.info(`Latest tag found: ${latestTag}`);
        currentVersion = latestTag.startsWith('v') ? latestTag : `v${latestTag}`;
      }
    } catch (error) {
      core.info('No tags found in the repository.');
    }
    setEnvironmentVariable('CURRENT_VERSION', currentVersion);

    // Get NEXT_VERSION and VERSION_BUMP_REASON
    const { nextVersion, versionBumpReason } = getNextVersion(latestTag, github.context.payload.head_commit.message.toLowerCase(), github.context.ref.toLowerCase());
    core.info(`Final nextVersion: ${nextVersion}`);
    core.info(`Final versionBumpReason: ${versionBumpReason}`);
    setEnvironmentVariable('NEXT_VERSION', nextVersion);
    setEnvironmentVariable('VERSION_BUMP_REASON', versionBumpReason);
    core.setOutput('NEXT_VERSION', nextVersion);

  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message}`);
  }
}
