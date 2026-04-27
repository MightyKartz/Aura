import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMarksStorageKey,
  createResumeStorageKey,
  formatPlaybackTime,
  saveMarkForUrl,
  readMarksForUrl,
  trimMarks,
  writeResumePointForUrl,
  readResumePointForUrl,
  getLatestMark
} from '../../apps/extension/runtime/utility-state.js';

function createMemoryStorage(initial = {}) {
  const memory = { ...initial };
  return {
    async get(key) {
      if (key === null) return { ...memory };
      return { [key]: memory[key] ?? null };
    },
    async set(payload) {
      Object.assign(memory, payload);
    },
    async remove(key) {
      delete memory[key];
    },
    dump() {
      return { ...memory };
    }
  };
}

test('create scoped storage keys for marks and resume data', () => {
  assert.equal(
    createMarksStorageKey('https://v.qq.com/x/cover/demo.html#player'),
    'aura:mvp:marks:https%3A%2F%2Fv.qq.com%2Fx%2Fcover%2Fdemo.html'
  );
  assert.equal(
    createResumeStorageKey('https://v.qq.com/x/cover/demo.html#player'),
    'aura:mvp:resume:https%3A%2F%2Fv.qq.com%2Fx%2Fcover%2Fdemo.html'
  );
});

test('formatPlaybackTime renders hh:mm:ss when needed', () => {
  assert.equal(formatPlaybackTime(0), '00:00');
  assert.equal(formatPlaybackTime(12.2), '00:12');
  assert.equal(formatPlaybackTime(754), '12:34');
  assert.equal(formatPlaybackTime(3723), '01:02:03');
});

test('saveMarkForUrl appends marks, trims to recent entries, and returns latest mark', async () => {
  const storage = createMemoryStorage();

  for (let index = 0; index < 14; index += 1) {
    await saveMarkForUrl('https://v.qq.com/x/cover/demo.html#hash', {
      timeSec: index * 10,
      label: formatPlaybackTime(index * 10),
      createdAt: index + 1
    }, storage);
  }

  const marks = await readMarksForUrl('https://v.qq.com/x/cover/demo.html', storage);
  assert.equal(marks.length, 12);
  assert.deepEqual(marks[0], { timeSec: 20, label: '00:20', createdAt: 3 });
  assert.deepEqual(getLatestMark(marks), { timeSec: 130, label: '02:10', createdAt: 14 });
});

test('trimMarks removes invalid items and keeps the newest 12', () => {
  const trimmed = trimMarks([
    null,
    { timeSec: 5, label: '00:05', createdAt: 1 },
    { timeSec: Number.NaN, label: 'bad', createdAt: 2 },
    ...Array.from({ length: 13 }, (_, i) => ({
      timeSec: i + 10,
      label: `00:${String(i + 10).padStart(2, '0')}`,
      createdAt: i + 10
    }))
  ]);

  assert.equal(trimmed.length, 12);
  assert.equal(trimmed[0].timeSec, 11);
  assert.equal(trimmed.at(-1).timeSec, 22);
});

test('writeResumePointForUrl persists the latest resume point per page', async () => {
  const storage = createMemoryStorage();

  await writeResumePointForUrl('https://v.qq.com/x/cover/demo.html#foo', {
    timeSec: 812,
    label: '13:32',
    updatedAt: 100
  }, storage);

  assert.deepEqual(
    await readResumePointForUrl('https://v.qq.com/x/cover/demo.html', storage),
    { timeSec: 812, label: '13:32', updatedAt: 100 }
  );
});
