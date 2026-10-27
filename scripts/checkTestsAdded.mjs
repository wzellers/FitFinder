#!/usr/bin/env node
/**
 * CI check: a pull request that changes app code must also change a test.
 *
 * App code is anything under src/ outside src/__tests__/ (type declarations,
 * stylesheets and Markdown don't count). Docs, config and CI-only PRs pass.
 * Only added, modified and renamed files count, so deleting code needs no
 * test. When a change really needs none, add the `no-tests-needed` label to
 * the PR.
 *
 * Usage (from CI): node scripts/checkTestsAdded.mjs <base-sha> <head-sha>
 */

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Whether `file` is app code that should come with a test. */
export function isAppCode(file) {
  return (
    file.startsWith('src/') && !file.startsWith('src/__tests__/') && !/\.(d\.ts|css|md)$/.test(file)
  );
}

/** Whether `file` is a test (unit, component, end-to-end or helper). */
export function isTest(file) {
  return file.startsWith('src/__tests__/');
}

/**
 * @param {string[]} files Paths changed by the PR, relative to the repo root.
 * @returns {{ ok: boolean, appCode: string[], tests: string[] }}
 */
export function checkTestsAdded(files) {
  const appCode = files.filter(isAppCode);
  const tests = files.filter(isTest);
  return { ok: appCode.length === 0 || tests.length > 0, appCode, tests };
}

function main([base, head]) {
  if (!base || !head) {
    console.error('Usage: node scripts/checkTestsAdded.mjs <base-sha> <head-sha>');
    process.exit(2);
  }
  const files = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=AMR', `${base}...${head}`],
    { encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean);
  const { ok, appCode, tests } = checkTestsAdded(files);
  if (ok) {
    console.log(
      appCode.length === 0
        ? 'No app code changed.'
        : `App code changed with ${tests.length} test file(s) changed.`,
    );
    return;
  }
  console.error(
    [
      'This PR changes app code but no tests:',
      ...appCode.map((f) => `  ${f}`),
      '',
      'Add or update tests in src/__tests__ (see CONTRIBUTING.md → Testing policy).',
      'If this change genuinely needs none, add the "no-tests-needed" label.',
    ].join('\n'),
  );
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2));
}
