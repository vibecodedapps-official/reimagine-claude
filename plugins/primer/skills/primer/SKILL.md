---
name: primer
description: 'Use when the user says "turn this into a skill", "we keep doing this", "add this to the project instructions" or "check the instruction files", or runs /primer. Keeps the project instructions of a repository in the forms Claude Code loads: a short CLAUDE.md hub, path-scoped rules, nested CLAUDE.md files and skills.'
---

# primer

This prerelease ships the drift hook only; the `init`, `adopt` and `maintain` modes are not in it.

Reply with this one line and stop, reading and writing nothing:

`primer: this prerelease has no modes yet; the drift hook checks each commit in a repository whose CLAUDE.md starts with <!-- primer -->.`
