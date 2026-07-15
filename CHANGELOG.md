# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-15

### Added
- OpenSCAD Integration to write and compile `.scad` code to `.stl` directly via a background Web Worker.
- Dynamic `Makefile` for zero-configuration Docker orchestration and native setups.
- Dynamic Gizmo mapping with Transform controls.

### Changed
- Migrated the default container deployment port to **3333** to prevent standard port collisions on 3000.
- Cleaned up project structure by organizing components and utilities into a clean `/src` folder hierarchy.

### Fixed
- Adjusted the global Viewer lifecycle to resolve lingering memory leaks on hot module replacements.

## [1.0.0] - 2026-06-01

### Added
- Initial Release of STL Editor Pro!
- Robust STL Loading with drag & drop handling.
- Integrated Three.js and `three-bvh-csg` for Constructive Solid Geometry operations.
- Volume and bounding box calculation metrics.
