# Help Mode V1 Status

## Milestone Summary

| Area | Status | Notes |
| --- | --- | --- |
| Help provider and persistence | Done | Global help mode, tour state, and local-storage persistence are implemented. |
| Help launcher and help home | Done | Header launcher, help home dialog, glossary access, and onboarding entry points are present. |
| Glossary-backed contextual hints | Done | Shared help registry powers details, advanced search, header controls, tree controls, and tab hints. |
| Stable help anchors | Done | Header, tree, details tabs, and tab content regions have tour anchors. |
| Static guided tour overlay | Done | Overlay supports focus handling, keyboard navigation, target highlighting, centered fallback, and now cleanly yields to the help modal instead of trapping clicks behind an active tour. |
| Demo-capable guided tour | Done | Beginner overview now loads a real year and entrypoint, filters the tree, selects a concept, opens non-default tabs, and runs step preparation once per step activation to avoid repeated loading loops. |
| Automated demo API | Done | Explorer-owned demo actions/state are exposed through the help runtime without exposing raw setters. |
| Tests and validation | Done | Test and build pass; lint is warning-only with no remaining errors. |

## Explicit V1 Decisions

- V1 includes one canonical automated beginner tour, not a multi-tour onboarding suite.
- The glossary stays embedded in the existing help dialog rather than becoming a separate route.
- Demo behavior uses existing visible taxonomy years and fetched entrypoints instead of introducing a dedicated backend demo dataset.

## Deferred Beyond V1

- Multiple specialized tours for different personas or workflows.
- Analytics or instrumentation for help usage.
- Localization of glossary/help copy beyond the currently implemented English-oriented content.
