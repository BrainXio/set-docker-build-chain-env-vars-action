const core = require('@actions/core');
const github = require('@actions/github');
const { execSync } = require('child_process');
const semver = require('semver');

try {
  // Ensure required inputs are provided
  const imageBase = core.getInput('image_base', { required: true });
  const imageVersion = core.getInput('image_version', { required: true });
  const artifactSuffix = core.getInput('artifact_suffix', { required: true });

  // Set APP_NAME
  const repo = github.context.repo.repo;
  const appName = repo.replace('-container', '').toLowerCase();
  core.exportVariable('APP_NAME', appName);

  // Set SAFE_IMAGE_BASE
  const safeImageBase = imageBase.replace(/\//g, '-').replace(/-$/, '');
  core.exportVariable('SAFE_IMAGE_BASE', safeImageBase);

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
  core.exportVariable('BUILDER_IMAGE_VERSION', builderImageVersion);

  // Use the branch directly from the context
  const branch = github.context.ref.replace('refs/heads/', '').replace(/\//g, '-').toLowerCase();
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
  const artifactDir = `artifacts/${new Date().toISOString().split('T')[0]}/${github.context.runId}/${safeImageBase}/${builderImageVersion}/${artifactSuffix}`;
  core.exportVariable('ARTIFACT_DIR', artifactDir);

  // Create Artifact Storage
  execSync(`mkdir -p ${artifactDir}`);
  core.info(`Artifact storage created at ${artifactDir}`);

  // Determine CURRENT_VERSION and NEXT_VERSION
  let latestTag;
  let currentVersion = 'v0.0.0'; // Default version if no tags are found
  try {
    latestTag = execSync('git describe --tags --abbrev=0').toString().trim();
    core.info(`Latest tag found: ${latestTag}`);
    currentVersion = latestTag.startsWith('v') ? latestTag : `v${latestTag}`;
  } catch (error) {
    core.info('No tags found in the repository.');
  }
  core.exportVariable('CURRENT_VERSION', currentVersion);
  core.info(`Exported CURRENT_VERSION: ${currentVersion}`);

  let nextVersion = 'v0.0.1'; // Default next version if no tags are found
  let versionBumpReason = 'default';

  if (latestTag) {
    let version = latestTag.startsWith('v') ? latestTag.substring(1) : latestTag;

    // Normalize partial versions to full semver
    const parts = version.split('.');
    if (parts.length === 1) {
      version = `${version}.0.0`;
    } else if (parts.length === 2) {
      version = `${version}.0`;
    }

    version = semver.parse(version);
    core.info(`Current version parsed: ${version.version}`);
    if (version) {
      let incrementType = 'patch';
      const commitMessage = github.context.payload.head_commit.message.toLowerCase();
      const sourceBranch = github.context.ref.toLowerCase();
      core.info(`Commit message: ${commitMessage}`);
      core.info(`Source branch: ${sourceBranch}`);

      // Determine increment type based on commit message
      if (commitMessage.startsWith('breaking change:') || commitMessage.startsWith('major:') || commitMessage.startsWith('!:')) {
        incrementType = 'major';
        versionBumpReason = 'commit message';
      } else if (commitMessage.startsWith('feature:') || commitMessage.startsWith('feat:')) {
        incrementType = 'minor';
        versionBumpReason = 'commit message';
      } else if (commitMessage.startsWith('bugfix:') || commitMessage.startsWith('hotfix:') || commitMessage.startsWith('fix:')) {
        incrementType = 'patch';
        versionBumpReason = 'commit message';
      }

      // Override increment type based on branch name if necessary
      if (sourceBranch.includes('/feature/')) {
        incrementType = 'minor';
        versionBumpReason = 'branch name';
      } else if (sourceBranch.includes('/bugfix/') || sourceBranch.includes('/hotfix/')) {
        incrementType = 'patch';
        versionBumpReason = 'branch name';
      } else if (sourceBranch.startsWith('refs/heads/release/v')) {
        const releaseVersion = sourceBranch.replace('refs/heads/release/v', '');
        core.info(`Release version from branch: ${releaseVersion}`);
        if (semver.valid(releaseVersion) && semver.gt(releaseVersion, version.version)) {
          nextVersion = `v${releaseVersion}`;
          versionBumpReason = 'release branch';
          core.info(`Next version from release branch: ${nextVersion}`);
        } else {
          core.setFailed('Invalid or non-incremental release version in branch name.');
        }
      }

      if (nextVersion === 'v0.0.1') {
        nextVersion = `v${semver.inc(version.version, incrementType)}`;
        core.info(`Next version determined: ${nextVersion}`);
      }
    }
  }

  core.exportVariable('NEXT_VERSION', nextVersion);
  core.exportVariable('VERSION_BUMP_REASON', versionBumpReason);
  core.info(`Exported NEXT_VERSION: ${nextVersion}`);
  core.info(`Exported VERSION_BUMP_REASON: ${versionBumpReason}`);

} catch (error) {
  core.setFailed(`Action failed with error: ${error.message}`);
}
