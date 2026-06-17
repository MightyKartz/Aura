import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInfoLayerModel,
  getTopLeftSemanticLabel
} from '../../apps/extension/runtime/info-layer.js';

test('getTopLeftSemanticLabel prefers character semantic hint, then show context, then skin tags, then skin name', () => {
  assert.equal(
    getTopLeftSemanticLabel({
      showContext: '古装权谋夜色',
      skin: {
        tags: ['悬疑'],
        name: '守望',
        characterTheme: {
          layer: 'mapped',
          archetype: 'ancient-general',
          themeName: '桃林守望',
          themeSlug: 'peach-guard',
          topLeftAtmosphere: {
            motifs: ['桃枝', '月影'],
            semanticHint: '桃林守望'
          },
          bottomRightCharacter: {
            role: '文人将军',
            pose: '半身守望',
            prop: '执杯'
          },
          motionLanguage: {
            focus: '视线轻偏',
            accent: '披风边微动'
          },
          microcopyTone: 'restrained'
        }
      }
    }),
    '桃林守望'
  );
  assert.equal(
    getTopLeftSemanticLabel({ showContext: '古装权谋夜色', skin: { tags: ['悬疑'], name: '守望' } }),
    '古装权谋夜色'.slice(0, 8)
  );
  assert.equal(
    getTopLeftSemanticLabel({ showContext: '', skin: { tags: ['悬疑观察线'], name: '守望' } }),
    '悬疑观察线'
  );
  assert.equal(
    getTopLeftSemanticLabel({ showContext: '', skin: { tags: [], name: '默认小猫陪看版' } }),
    '默认小猫陪看版'.slice(0, 8)
  );
});

test('buildInfoLayerModel prefers prompt text and keeps utility summary for overlay', () => {
  const model = buildInfoLayerModel({
    skin: { tags: ['悬疑'], name: '侦探猫' },
    showContext: '权谋',
    prompt: { text: '已标记 12:33', type: 'mark-saved' },
    utilitySummary: {
      markCount: 3,
      latestMark: {
        timeSec: 753,
        label: '12:33',
        createdAt: 1
      },
      recentMarkLabel: '12:33',
      resumePointLabel: '13:42'
    },
    playbackControl: {
      canReadTime: true,
      canSeek: true
    }
  });

  assert.deepEqual(model, {
    semanticLabel: '权谋',
    feedbackText: '已标记 12:33',
    feedbackType: 'mark-saved',
    utilityLabel: '回看 13:42',
    latestMarkLabel: '12:33',
    latestMarkTimeSec: 753,
    canMarkMoment: true,
    canReplayLatestMark: true,
    microcopyTone: 'gentle'
  });
});

test('buildInfoLayerModel falls back to resume point or mark count when no prompt exists', () => {
  assert.deepEqual(
    buildInfoLayerModel({
      skin: { tags: ['古偶'], name: '月下执扇' },
      showContext: '',
      utilitySummary: {
        markCount: 0,
        recentMarkLabel: '',
        resumePointLabel: '08:08'
      },
      playbackControl: {
        canReadTime: false,
        canSeek: false
      }
    }),
    {
      semanticLabel: '古偶',
      feedbackText: '',
      feedbackType: '',
      utilityLabel: '回看 08:08',
      latestMarkLabel: '',
      latestMarkTimeSec: null,
      canMarkMoment: false,
      canReplayLatestMark: false,
      microcopyTone: 'gentle'
    }
  );

  assert.deepEqual(
    buildInfoLayerModel({
      skin: { tags: [], name: '默认小猫' },
      showContext: '',
      utilitySummary: {
        markCount: 2,
        latestMark: {
          timeSec: 82,
          label: '01:22',
          createdAt: 1
        },
        recentMarkLabel: '01:22',
        resumePointLabel: ''
      },
      playbackControl: {
        canReadTime: true,
        canSeek: false
      }
    }),
    {
      semanticLabel: '默认小猫',
      feedbackText: '',
      feedbackType: '',
      utilityLabel: '最近 01:22',
      latestMarkLabel: '01:22',
      latestMarkTimeSec: 82,
      canMarkMoment: true,
      canReplayLatestMark: false,
      microcopyTone: 'gentle'
    }
  );
});

test('buildInfoLayerModel falls back to count copy when no resume point or recent mark exists', () => {
  assert.deepEqual(
    buildInfoLayerModel({
      skin: { tags: ['古装'], name: '桃林守望', characterTheme: null },
      showContext: '',
      utilitySummary: {
        markCount: 2,
        recentMarkLabel: '',
        resumePointLabel: ''
      },
      playbackControl: {
        canReadTime: true,
        canSeek: true
      }
    }),
    {
      semanticLabel: '古装',
      feedbackText: '',
      feedbackType: '',
      utilityLabel: '已标记 2 处',
      latestMarkLabel: '',
      latestMarkTimeSec: null,
      canMarkMoment: true,
      canReplayLatestMark: false,
      microcopyTone: 'gentle'
    }
  );
});
