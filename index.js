const core = require('@actions/core');
const github = require('@actions/github');
const { execSync } = require('child_process');
const semver = require('semver');

try {
  // Set APP_NAME
  const repo = github.context.repo.repo;
  const appName = repo.replace('-container', '').toLowerCase();
  core.exportVariable('APP_NAME', appName);

  // Set SAFE_IMAGE_BASE
  const imageBase = core.getInput('image_base');
  const safeImageBase = imageBase.replace(/\//g, '-').replace(/-$/, '');
  core.exportVariable('SAFE_IMAGE_BASE', safeImageBase);

  // Set BUILDER_IMAGE_VERSION
  const ref = github.context.ref;
  const eventName = github.context.eventName;
  const imageVersion = core.getInput('image_version');
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
  core.exportVariable('BUILDER_IMAGE_VERSION', builderImageVersion);

  // Use the branch input
  const branch = core.getInput('branch').replace(/\//g, '-').toLowerCase();
  core.info(`Branch: ${branch}`);

  // Use runAttempt or provide a default value
  const runAttempt = github.context.runAttempt || '1';
  core.info(`Run Attempt: ${runAttempt}`);

  // Set BUILD_ID
  const shortSha = github.context.sha.substring(0, 7);
  const imageTag = `${shortSha}-${github.context.runId}-${github.context.runNumber}-${runAttempt}-${branch}-${safeImageBase}-${builderImageVersion}`;
  core.exportVariable('BUILD_ID', imageTag);

  // Set BUILDER_ID
  const prefix = core.getInput('prefix');
  const builderId = prefix ? `${prefix}-${imageTag}` : imageTag;
  core.exportVariable('BUILDER_ID', builderId);

  // Set ARTIFACT_DIR
  const artifactSuffix = core.getInput('artifact_suffix');
  const artifactDir = `artifacts/${new Date().toISOString().split('T')[0]}/${github.context.runId}/${safeImageBase}/${builderImageVersion}/${artifactSuffix}`;
  core.exportVariable('ARTIFACT_DIR', artifactDir);

  // Create Artifact Storage
  execSync(`mkdir -p ${artifactDir}`);
  core.info(`Artifact storage created at ${artifactDir}`);

  // Determine NEXT_VERSION
  let latestTag;
  try {
    latestTag = execSync('git describe --tags --abbrev=0').toString().trim();
  } catch (error) {
    core.info('No tags found in the repository.');
  }

  let nextVersion = 'v0.0.1'; // Default version if no tags are found
  if (latestTag) {
    let currentVersion = latestTag.startsWith('v') ? latestTag.substring(1) : latestTag;
    
    // Normalize partial versions to full semver
    const parts = currentVersion.split('.');
    if (parts.length === 1) {
      currentVersion = `${currentVersion}.0.0`;
    } else if (parts.length === 2) {
      currentVersion = `${currentVersion}.0`;
    }

    currentVersion = semver.parse(currentVersion);
    if (currentVersion) {
      let incrementType = 'patch';
      const commitMessage = github.context.payload.head_commit.message.toLowerCase();
      const sourceBranch = ref.toLowerCase();
      
      if (commitMessage.startsWith('breaking change:') || commitMessage.startsWith('major:') || commitMessage.startsWith('!:')) {
        incrementType = 'major';
      } else if (commitMessage.startsWith('feature:') || commitMessage.startsWith('feat:')) {
        incrementType = 'minor';
      } else if (commitMessage.startsWith('bugfix:') || commitMessage.startsWith('hotfix:') || commitMessage.startsWith('fix:')) {
        incrementType = 'patch';
      } else if (sourceBranch.includes('/feature/')) {
        incrementType = 'minor';
      } else if (sourceBranch.includes('/bugfix/') || sourceBranch.includes('/hotfix/')) {
        incrementType = 'patch';
      } else if (sourceBranch.startsWith('refs/heads/release/v')) {
        const releaseVersion = sourceBranch.replace('refs/heads/release/v', '');
        if (semver.valid(releaseVersion) && semver.gt(releaseVersion, currentVersion)) {
          nextVersion = `v${releaseVersion}`;
        } else {
          core.setFailed('Invalid or non-incremental release version in branch name.');
        }
      }

      if (incrementType !== 'release') {
        nextVersion = `v${semver.inc(currentVersion.version, incrementType)}`;
      }
    }
  }

  core.exportVariable('NEXT_VERSION', nextVersion);

} catch (error) {
  core.setFailed(`Action failed with error: ${error.message}`);
}
