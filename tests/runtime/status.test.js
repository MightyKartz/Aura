import test from 'node:test';
import assert from 'node:assert/strict';

import { createStatusReporter } from '../../apps/extension/runtime/status.js';

globalThis.HTMLVideoElement = globalThis.HTMLVideoElement || class HTMLVideoElement {};

test('status reporter persists corner feedback and utility summary fields', async () => {
  const memory = {};
  const storageArea = {
    async get(key) {
      return { [key]: memory[key] ?? null };
    },
    async set(payload) {
      Object.assign(memory, payload);
    },
    async remove(key) {
      delete memory[key];
    }
  };

  const reporter = createStatusReporter({
    frameId: 'frame-1',
    getPageUrl: () => 'https://v.qq.com/x/cover/demo.html#hash',
    writeStatus: (payload) => storageArea.set(payload),
    migrateLegacy: () => Promise.resolve(false),
    getNow: () => 123
  });

  reporter.renderStatus({
    title: '测试剧集',
    showContext: '权谋',
    container: { getBoundingClientRect: () => ({ width: 1280, height: 720 }) },
    containerSource: 'detector',
    video: null,
    skin: { id: 'skin-1', name: '桃林守望' },
    skinSource: 'auto',
    visualState: {
      playbackMode: 'fullscreen',
      playbackState: 'paused',
      controlsVisible: false,
      adActive: false
    },
    reason: 'test',
    settings: { enabled: true, mode: 'standard' },
    diagnostics: {
      cornerSemanticLabel: '权谋',
      cornerFeedbackPrompt: '回看点已存 12:33',
      cornerFeedbackPromptType: 'mark-saved',
      markCount: 3,
      recentMarkLabel: '12:33',
      resumePointLabel: '13:42'
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const [entry] = Object.values(memory);
  assert.equal(entry.cornerSemanticLabel, '权谋');
  assert.equal(entry.cornerFeedbackPrompt, '回看点已存 12:33');
  assert.equal(entry.cornerFeedbackPromptType, 'mark-saved');
  assert.equal(entry.markCount, 3);
  assert.equal(entry.recentMarkLabel, '12:33');
  assert.equal(entry.resumePointLabel, '13:42');
});
