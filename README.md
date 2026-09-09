# Modpack Doctor

A private, browser-side Minecraft modpack crash and maintenance suite.

**Live app:** https://mrhakan.github.io/modpack-doctor/

Everything runs in the browser. Logs, JAR metadata, pack inventories, snapshots, and diagnostics stay local unless you explicitly copy or share a sanitized diagnosis summary.

## Core crash diagnosis

- Drag & drop `latest.log`, `debug.log`, crash reports, or PrismLauncher/MultiMC output
- Multiple logs can be combined
- Detects Minecraft, Fabric/Forge/NeoForge/Quilt, Java, OS, memory hints, and mod count
- Dependency, duplicate-mod, Mixin, binary incompatibility, missing-class, Java, memory, config, native/GPU, OpenGL/LWJGL, datapack/resource and access-transform diagnostics
- Evidence with line numbers
- Suspect namespace ranking
- Confidence estimates and health score
- Markdown report export

## Doctor Lab

### Pack Scanner

- Browser-side ZIP/JAR reader; no upload server
- Scan `.jar`, `.zip`, `.mrpack`, selected folders, or directly granted Prism/Minecraft instance folders
- Reads Fabric / Quilt / Forge / NeoForge mod metadata
- Top-level and embedded JAR inventory
- Dependency graph
- Missing mandatory dependency detection
- Duplicate mod IDs
- Required-side / client-server mismatch checks
- Compatibility overlap checks
- Mixin surface map
- Access Widener / Access Transformer inspector
- Embedded library/version inspector
- Config Doctor for JSON/TOML/YAML/properties-style files
- Datapack/resource/world structural inspection
- Safe Boot Profile suggestions
- Per-mod update-risk / blast-radius score
- Pack Health Dashboard

### Working vs Broken

- Working-pack vs broken-pack diff
- Added / removed / version-changed mods
- Config-change detection
- Suspect Ranking 2.0 using pack changes + crash evidence + dependency/mixin blast radius
- Client vs Server Doctor
- Local pack snapshots
- Rollback planner
- What Changed? timeline

### Interactive Debugger

- Crash fingerprinting and previous-crash similarity
- Binary Search Assistant for large suspect sets
- Quarantine manifest
- Ordered Automatic Fix Plan with confidence
- Java Advisor
- Memory Profiler
- Startup Profiler
- Performance Doctor
- GPU / driver hints
- Shader Doctor
- Registry & World Doctor
- Runtime Mixin / access diagnostics
- Folder Watch mode for `logs/latest.log` through the browser File System Access API

### Reports & tools

- Privacy Redactor for common usernames, paths, emails, IPs, UUIDs and obvious token fields
- Sanitized GitHub/Discord issue-report generator
- Shareable diagnosis-only URL fragments; full logs are not embedded
- One-click full pack report
- Browser-based Doctor CLI
- Doctor Knowledge Base
- Benchmark snapshots derived from logs and scans

## Browser limitations

The website never silently modifies your Minecraft instance. Quarantine, rollback, Safe Boot and fix plans are generated as instructions/manifests for you to apply. Direct folder access and Folder Watch require a browser that supports the File System Access API (typically Chromium-based browsers); normal ZIP/JAR/folder upload works as a fallback.

## Safety

Diagnostics are evidence-based heuristics, not proof. Always back up an instance or world before removing mods, regenerating configs, or changing versions.
