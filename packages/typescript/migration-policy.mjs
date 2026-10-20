import assert from 'node:assert/strict';

export const evolvedFiles = ['runtime.ts', 'index.ts', 'generated/client.ts', 'client-generation.mjs'];
export function verifyEvolution(lineage, evolution, current) {
  assert.equal(lineage.source.commit, 'b2541c789f83b8bbc5510244dd803a2284197982');
  assert.equal(evolution.version, 1);
  assert.equal(evolution.baseline.commit, '5eef804afb984c1af0453e6a224a61716fc381b5');
  assert.equal(evolution.cohort, 'ordinary-end-user-writes-v1');
  assert.deepEqual(Object.keys(evolution.files).sort(), [...evolvedFiles].sort(), 'evolution_file_cohort');
  const unchanged = {}; const evolved = {};
  for (const [name, hash] of Object.entries(current)) {
    if (evolvedFiles.includes(name)) {
      assert.equal(hash, evolution.files[name], `reviewed_evolution_drift:${name}`);
      assert.notEqual(hash, lineage.files[name], 'evolution_requires_real_change');
      evolved[name] = { migratedSha256: lineage.files[name], currentSha256: hash };
    } else {
      assert.equal(hash, lineage.files[name], `reviewed_source_drift:${name}`);
      unchanged[name] = hash;
    }
  }
  for (const name of evolvedFiles) assert.ok(evolved[name], 'missing_evolution_file');
  return { unchanged, evolved };
}
