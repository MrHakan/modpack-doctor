# Modpack Doctor

A private, browser-side Minecraft modpack crash log analyzer.

**Live app:** https://mrhakan.github.io/modpack-doctor/

## MVP features

- Drag & drop `latest.log`, `debug.log`, crash reports, or PrismLauncher/MultiMC output
- Multiple log files can be combined in one analysis
- Detects Minecraft version, loader, loader version, Java, OS, memory hints, and mod count when present
- Diagnostic rules for:
  - missing/incompatible dependencies
  - duplicate mods
  - Mixin failures
  - `NoSuchMethodError` / `NoSuchFieldError` / binary incompatibility
  - missing classes / dependencies
  - Java version mismatch
  - out-of-memory and stack overflow
  - config parsing failures
  - access widener / access transformer failures
  - native JVM / driver crashes
  - OpenGL / LWJGL problems
  - resource/datapack parse failures
- Ranks suspect mod IDs/namespaces from stack traces and loader messages
- Shows evidence with line numbers
- Health score and confidence estimates
- Copy or download a Markdown diagnostic report
- Entire analysis runs locally in the browser — logs are not uploaded

## Why a web app first?

The core problem is text parsing, so a static client-side app gives us:

- zero backend cost
- easy GitHub Pages deployment
- privacy by default
- instant iteration on diagnostic rules
- a clean path to a later Tauri desktop build using the same engine

## Roadmap

- [ ] Smarter Fabric/Forge/NeoForge mod-list parser
- [ ] Conflict graph between suspect mods
- [ ] Known issue signature database
- [ ] JVM flag and RAM sanity checker
- [ ] Pack comparison: working log vs broken log
- [ ] `mods/` folder inventory import
- [ ] exportable support bundle
- [ ] optional Tauri desktop app
- [ ] automated rule tests with sanitized fixture logs

## Safety

The fixes are heuristic suggestions. Back up the instance before removing configs/mods or changing versions.
