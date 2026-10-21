---
paths:
  - "plugins/**"
  - ".claude-plugin/marketplace.json"
---
# Plugins

`plugins/<name>/` holds only what a user installs: no tests, design documents or fixtures. Every shipped file under `plugins/` is ASCII. No shipped file names a person, a person's email address, an absolute path under a user's home, or a repository other than this one.

No manifest declares `userConfig` or `dependencies`.

A new script under `plugins/` ships only with its test under `tests/`. The awk-using audit scripts run on mawk as well as on the awk of each system.

Each plugin's manifest version and catalog entry agree, and a plugin directory changed since its last tag carries a version above that tag.
