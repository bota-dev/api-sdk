import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { evolvedFiles, verifyEvolution } from './migration-policy.mjs';

const lineage = JSON.parse(await readFile(new URL('./lineage.json', import.meta.url)));
const evolution = JSON.parse(await readFile(new URL('./source-evolution.json', import.meta.url)));
const current = { ...Object.fromEntries(evolvedFiles.map(name => [name, evolution.files[name]])),
  'input.json': lineage.files['input.json'], 'conformance/corpus.json': lineage.files['conformance/corpus.json'] };
test('historical migration remains distinct from explicitly reviewed runtime evolution', () => {
  const result = verifyEvolution(lineage, evolution, current);
  assert.equal(Object.keys(result.evolved).length, 4);
  assert.equal(result.unchanged['input.json'], lineage.files['input.json']);
  for (const file of Object.keys(current)) assert.throws(() => verifyEvolution(lineage, evolution, { ...current, [file]: 'altered' }));
  for (const patch of [{ cohort: 'arbitrary-writes' }, { files: { ...evolution.files, 'input.json': current['input.json'] } },
    { baseline: { commit: '0'.repeat(40) } }]) assert.throws(() => verifyEvolution(lineage, { ...evolution, ...patch }, current));
});
