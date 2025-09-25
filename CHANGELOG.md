# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.3] - 2024-09-XX

### Added
- Sequential and concurrent orchestration modes
- Consecutive success limits for provider switching
- In-memory caching with TTL
- Comprehensive metrics tracking (success/failure rates, latency)
- Graceful error handling with quirky failure messages
- Zod-based config validation
- TypeScript types and exports
- Extensive test coverage
- Production-ready build pipeline with tsup
- NPM package metadata and documentation

### Changed
- Simplified API: `say(input, config)` returns `{raw_response, text}`
- Class-based Orchestrator for better extensibility
- Improved text extraction with fallbacks

### Fixed
- Robust HTTP request handling for browser and Node
- Proper environment variable handling for API keys

## [0.0.2] - 2024-09-XX

### Added
- Basic orchestration with failover
- Caching and metrics
- Multiple test files

## [0.0.1] - 2024-09-XX

### Added
- Initial implementation with basic features