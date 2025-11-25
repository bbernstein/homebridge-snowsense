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

### Releases
- `npm version prerelease` - Build next prerelease version
- `npm publish --tag beta` - Publish prerelease to npm beta channel
- `npm version patch|minor|major` - Build next release version
- `npm publish` - Publish stable release to npm

## Testing Guidelines

### Test Organization
- Tests live alongside source files in files named `*.spec.ts`
- Unit tests should use mocked dependencies (ts-mockito)
- Each class should have a corresponding spec file

### Coverage Requirements
- Minimum 90% coverage required (currently at 100%)
- Run `npm run test:coverage` to verify before committing
- Coverage excludes: `*.d.ts`, `*.spec.ts`

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

- Supported versions: Node 18, 20, 22, 24
- Node 22+ requires `--localstorage-file` flag for Jest (handled in npm scripts)
- CI runs tests on Node 20, 22, and 24
