---
name: verify-before-done
description: Never report a change as done until the failing command passes in the sandbox. Use for every code change, fix, or migration.
license: Apache-2.0
---

# Verify before done

1. State the check that proves success (a test, a build, a smoke query) before editing.
2. Make the smallest change that can pass that check.
3. Run the check in the sandbox. If it fails, read the output and repair; do not claim success.
4. Report what ran, its exit code, and anything that was not run.
