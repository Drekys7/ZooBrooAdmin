# Forced test-release reset

The current test release intentionally replaces ALL local admin projects, resources,
local published snapshots and migration backups with `public/startup-template.json`.
Old browser data is not recoverable through this app after a successful reset.
Only this app's IndexedDB tables are cleared; other websites/storage are untouched.

This happens once per browser profile/origin, when the updated application starts.
Subsequent reloads retain edits made after the reset. An already-open old version must
be reloaded. This is not live synchronisation between browsers.

To issue another mandatory reset during testing:

1. Update and check `public/startup-template.json` (including its embedded images).
2. Increment `TEST_RELEASE_REVISION` in `src/infrastructure/test-release-reset.ts`.
3. Commit the template and source changes, build and deploy the resulting site.

A GitHub push alone only updates the repository, unless hosting is configured to
automatically deploy that branch. Ship the new JavaScript and template together.
Validation and installation are atomic: download/validation/storage failure leaves
the previous data intact and the next reload retries the reset.

Do not continue this destructive policy in production without a separate migration plan.
