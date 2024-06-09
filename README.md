# set-docker-build-chain-env-vars

## Overview

Hello, amazing developer! 🤖 `set-docker-build-chain-env-vars` is a GitHub Action that sets environment variables for Docker build chains and manages versioning based on commit messages and source branches. This action processes various inputs to generate and export several environment variables essential for your CI/CD pipelines.

## Features

- Sets environment variables for application name, safe image base, builder image version, build ID, builder ID, artifact directory, current version, next version, and version bump reason.
- Automatically bumps the version based on commit messages or source branches.
- Creates necessary artifact directories for build outputs.
- Provides detailed logging to help trace and debug the process.

## Usage

### Workflow Example

To use this action, add the following steps to your GitHub Actions workflow:

```yaml
name: Test Set Docker Build Chain Env Vars

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run Set Docker Build Chain Env Vars Action
        uses: brainxio/set-docker-build-chain-env-vars-action@v1
        with:
          image_base: 'nvidia/cuda'
          image_version: '12.5.6-base-ubuntu22.04'
          artifact_suffix: 'devel'
          prefix: 'custom'

      - name: Print Environment Variables
        run: |
          echo "APP_NAME=${{ env.APP_NAME }}"
          echo "SAFE_IMAGE_BASE=${{ env.SAFE_IMAGE_BASE }}"
          echo "BUILDER_IMAGE_VERSION=${{ env.BUILDER_IMAGE_VERSION }}"
          echo "BUILD_ID=${{ env.BUILD_ID }}"
          echo "BUILDER_ID=${{ env.BUILDER_ID }}"
          echo "ARTIFACT_DIR=${{ env.ARTIFACT_DIR }}"
          echo "CURRENT_VERSION=${{ env.CURRENT_VERSION }}"
          echo "NEXT_VERSION=${{ env.NEXT_VERSION }}"
          echo "VERSION_BUMP_REASON=${{ env.VERSION_BUMP_REASON }}"
```

### Inputs

- `image_base`: The base Docker image used for the build. (Required)
- `image_version`: The version of the Docker image used for the build. (Required)
- `artifact_suffix`: The suffix for the artifact directory. (Required)
- `prefix`: The prefix for the builder ID. (Optional)

### Outputs

This action does not produce direct outputs, but it sets the following environment variables:

- `APP_NAME`: The name of the application, derived from the repository name.
- `SAFE_IMAGE_BASE`: A sanitized version of the base image name.
- `BUILDER_IMAGE_VERSION`: The version of the builder image, modified based on branch or event context.
- `BUILD_ID`: A unique identifier for the build.
- `BUILDER_ID`: A prefixed version of the build ID.
- `ARTIFACT_DIR`: The directory path for storing artifacts.
- `CURRENT_VERSION`: The current semantic version based on the latest Git tag.
- `NEXT_VERSION`: The next semantic version based on the latest Git tag, commit message, and source branch.
- `VERSION_BUMP_REASON`: The reason for the version bump, indicating whether it was due to the commit message or the branch name.

### Security and Best Practices

**Environment Variables:** Ensure all necessary environment variables are set correctly.

**File Paths:** Validate and sanitize file paths to prevent security vulnerabilities.

**Error Handling:** Properly handle errors to avoid unexpected failures.

## Development

### Setting Up

1. **Clone the repository:**
   ```sh
   git clone https://github.com/brainxio/set-docker-build-chain-env-vars.git
   cd set-docker-build-chain-env-vars
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

### Linting

Ensure code quality and consistency using ESLint:

```sh
npx eslint .
```

### Running Tests

To ensure the action works as expected, create comprehensive test cases to verify its functionality.

### Contributing

We welcome contributions to improve this action. Please fork the repository and create a pull request with your changes. Ensure your code adheres to the established coding standards and includes relevant test cases.

## License

This project is licensed under the Unlicense License. See the [LICENSE](LICENSE) file for details.
