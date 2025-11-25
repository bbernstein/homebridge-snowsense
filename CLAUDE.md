# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

homebridge-snowsense is a Homebridge plugin that creates an Occupancy Sensor indicating snowy conditions using local weather forecast from OpenWeather API. Homebridge (https://github.com/homebridge/homebridge) is an open-source platform that connects custom devices to Apple HomeKit.

## Git Workflow

### Branch Policy
- **NEVER commit directly to the `main` branch**
- Always create a feature branch for any changes: `git checkout -b feature/description` or `fix/description`
- Submit changes via Pull Request for review and merge
- Branch naming conventions:
  - `feature/` - New features
  - `fix/` - Bug fixes
  - `chore/` - Maintenance tasks, dependency updates
  - `docs/` - Documentation only changes

### Before Committing
1. Run `npm run lint` to check for linting errors
2. Run `npm test` to ensure all tests pass
3. Run `npm run test:coverage` to verify coverage remains at 90%+
4. Run `npm run build` to ensure TypeScript compiles

## Development Commands

### Building and Running
- `npm run watch` - Start development server with hot reload
- `npm run build` - Build for production (TypeScript compilation)

### Testing
- `npm test` - Run all unit tests
- `npm run test:coverage` - Generate full coverage report with HTML output
- `npm run test:coverage-summary` - Quick coverage summary

### Code Quality
- `npm run lint` - Run ESLint on all TypeScript files
- `npm run prepublishOnly` - Run all checks (lint, test:coverage, build) before publishing

### Releases (via GitHub Actions)

Releases are managed via the GitHub Actions "Release" workflow, which uses npm OIDC Trusted Publishing (no npm tokens required).

**To create a release:**
1. Go to Actions > Release > Run workflow
2. Select release type: `patch`, `minor`, `major`, or `prerelease`
3. Select pre-release tag: `none`, `alpha`, `beta`, or `rc`
4. Optionally enable "Dry run" to test without publishing
5. Click "Run workflow"

**Examples:**
- `patch` + `none` = `1.0.0` → `1.0.1` (stable patch release)
- `minor` + `beta` = `1.0.0` → `1.1.0-beta.0` (beta of next minor)
- `prerelease` + `none` = `1.1.0-beta.0` → `1.1.0-beta.1` (increment beta)
- `patch` + `none` = `1.1.0-beta.1` → `1.1.1` (promote to stable patch)

**npm tags:**
- Stable releases → `latest`
- Alpha pre-releases → `alpha`
- Beta pre-releases → `beta`
- RC pre-releases → `rc`

**Note:** The release workflow commits the version bump directly to `main`. This is the only exception to the "never commit to main" rule, as it's automated and gated by manual workflow dispatch.

## Testing Guidelines

### Test Organization
- Tests live alongside source files in files named `*.spec.ts`
- Unit tests should use mocked dependencies (ts-mockito)
- Each class should have a corresponding spec file

### Coverage Requirements
- Enforced thresholds: 95% branches, 100% functions/lines/statements
- Run `npm run test:coverage` to verify before committing
- Coverage excludes: `*.d.ts`, `*.spec.ts`, `index.ts`

## Homebridge Plugin Architecture

### Key Files
- `src/index.ts` - Plugin registration with Homebridge
- `src/platform.ts` - Main platform class that manages accessories
- `src/platformAccessory.ts` - Accessory handler for the snow sensor
- `src/SnowWatch.ts` - Core snow monitoring logic
- `src/SnowForecastService.ts` - Weather API integration
- `src/SnowSenseConfig.ts` - Configuration validation

### Homebridge Concepts
- **Platform Plugin**: This plugin registers as a dynamic platform
- **Accessory**: Represents a single HomeKit device (Occupancy Sensor)
- **Service**: HomeKit service type (OccupancySensor)
- **Characteristic**: Individual properties (OccupancyDetected, Name)

## Node.js Compatibility

- Supported versions: Node 18+ (tested on 18, 20, 22, 24; Node 25 works but is not CI-tested as it's a development release)
- Node 22+ requires `--localstorage-file` flag for Jest (handled conditionally in npm scripts)
- CI runs tests on Node 18, 20, 22, and 24
