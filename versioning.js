import * as core from '@actions/core';
import semver from 'semver';
import { execSync } from 'child_process';

export function runCommand(command) {
  try {
    return execSync(command).toString().trim();
  } catch (error) {
    core.info(`Command failed: ${command}`);
    return null;
  }
}

export function getNextVersion(latestTag, commitMessage, sourceBranch) {
  let nextVersion = 'v0.0.1'; // Default next version if no tags are found
  let versionBumpReason = 'default';

  core.info(`Latest tag: ${latestTag}`);
  core.info(`Commit message: ${commitMessage}`);
  core.info(`Source branch: ${sourceBranch}`);

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
    core.info(`Parsed version: ${version.version}`);

    if (version) {
      let incrementType = 'patch';
      let incrementReason = '';

      // Determine increment type based on commit message
      if (commitMessage.startsWith('breaking change:') || commitMessage.startsWith('major:') || commitMessage.startsWith('!:')) {
        incrementType = 'major';
        incrementReason = 'commit message';
      } else if (commitMessage.startsWith('feature:') || commitMessage.startsWith('feat:')) {
        incrementType = 'minor';
        incrementReason = 'commit message';
      } else if (commitMessage.startsWith('bugfix:') || commitMessage.startsWith('hotfix:') || commitMessage.startsWith('fix:')) {
        incrementType = 'patch';
        incrementReason = 'commit message';
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
        if (semver.valid(releaseVersion) && semver.gt(releaseVersion, version.version)) {
          nextVersion = `v${releaseVersion}`;
          versionBumpReason = 'release branch';
          return { nextVersion, versionBumpReason };
        } else {
          core.setFailed('Invalid or non-incremental release version in branch name.');
          return { nextVersion: `v${version.version}`, versionBumpReason: 'default' };
        }
      }

      if (incrementReason) {
        versionBumpReason = incrementReason;
      }

      nextVersion = `v${semver.inc(version.version, incrementType)}`;
    }
  }

  return { nextVersion, versionBumpReason };
}
