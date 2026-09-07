const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'deploy-apps-script.yml');

test('production deployment is manual until the first smoke test passes', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s+push:/);
});

test('deployment tests before pushing and pins clasp', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const tests = workflow.indexOf('node --test tests/*.test.js');
  const push = workflow.indexOf('@google/clasp@3.4.1 push --force');
  assert.ok(tests >= 0 && push > tests);
  assert.match(workflow, /create-version/);
  assert.match(workflow, /update-deployment/);
});

test('deployment reads credentials only from secrets and removes temporary files', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  for (const secret of ['CLASPRC_JSON', 'CLASP_JSON', 'CLASP_DEPLOYMENT_ID']) {
    assert.match(workflow, new RegExp('secrets\\.' + secret));
  }
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /rm -f .*\.clasprc\.json.*\.clasp\.json/);
});

test('credential files are ignored by git', () => {
  const ignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
  assert.match(ignore, /^\.clasp\.json$/m);
  assert.match(ignore, /^\.clasprc\.json$/m);
});
