import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { validateSkinRegistry } from '../../apps/extension/runtime/skin-contract.js';
import { buildInfoLayerModel, getTopLeftSemanticLabel } from '../../apps/extension/runtime/info-layer.js';
import { resolveMotionProfile } from '../../apps/extension/runtime/motion-presets.js';
import { recommendSkinByText, resolveSkin } from '../../apps/extension/runtime/skin-registry.js';

function createRegistry() {
  return {
    version: 1,
    defaultSkinId: 'cat-default-v1',
    skins: [
      {
        id: 'cat-default-v1',
        name: '默认小猫',
        category: 'default',
        description: '默认陪看挂件。',
        match: { keywords: [] },
        assets: {
          topLeft: 'themes/skin-default-top-left.png',
          bottomRight: 'themes/skin-default-bottom-right.png'
        },
        palette: {
          primary: '#fff1cf',
          accent: '#ffd45f',
          glow: '#ffcf5a'
        },
        recommendedMode: 'standard',
        motionPreset: 'soft',
        tags: ['默认', '通用', '柔和']
      },
      {
        id: 'general-peach-guard-v1',
        name: '文人将军 · 桃林守望',
        category: 'character',
        description: '原创将军 archetype 的桃林守望气质映射。',
        match: {
          keywords: ['权谋', '守望', '将军', '桃林', '古装']
        },
        assets: {
          topLeft: 'themes/skin-peach-guard-top-left.png',
          bottomRight: 'themes/skin-peach-guard-bottom-right.png'
        },
        palette: {
          primary: '#2f4a58',
          accent: '#d2a062',
          glow: '#f3d7c7'
        },
        recommendedMode: 'standard',
        tags: ['权谋', '守望', '桃林'],
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
      },
      {
        id: 'lady-moon-fan-v1',
        name: '古风贵女 · 月下执扇',
        category: 'character',
        description: '原创贵女 archetype 的月下执扇气质映射，用半月、团扇与珠钗柔光承接古偶长线观看氛围。',
        match: {
          keywords: ['古偶', '贵女', '月下', '执扇', '花瓣', '流苏']
        },
        assets: {
          topLeft: 'themes/skin-moon-fan-top-left.png',
          bottomRight: 'themes/skin-moon-fan-bottom-right.png'
        },
        palette: {
          primary: '#5b4d7a',
          accent: '#d9c0a8',
          glow: '#f3dff7'
        },
        recommendedMode: 'quiet',
        tags: ['古偶', '月下', '执扇'],
        characterTheme: {
          layer: 'mapped',
          archetype: 'ancient-lady',
          themeName: '月下执扇',
          themeSlug: 'moon-fan',
          topLeftAtmosphere: {
            motifs: ['半月', '扇纹'],
            semanticHint: '月下执扇'
          },
          bottomRightCharacter: {
            role: '古风贵女',
            pose: '轻侧持扇',
            prop: '团扇'
          },
          motionLanguage: {
            focus: '扇面微移',
            accent: '珠钗轻晃'
          },
          microcopyTone: 'gentle'
        }
      }
    ]
  };
}

test('validateSkinRegistry accepts character themes with four mapped runtime variables', () => {
  const registry = createRegistry();
  assert.doesNotThrow(() => validateSkinRegistry(registry, { label: 'character-theme' }));
});

test('production registry locks character and detective skins to single-image PNG assets', () => {
  const registry = JSON.parse(
    readFileSync(resolve(process.cwd(), 'themes/manifests/builtin-skins.json'), 'utf8')
  );
  const defaultCat = registry.skins.find((skin) => skin.id === 'cat-default-v1');
  const suspenseCat = registry.skins.find((skin) => skin.id === 'cat-suspense-v1');
  const peachGuard = registry.skins.find((skin) => skin.id === 'general-peach-guard-v1');
  const moonFan = registry.skins.find((skin) => skin.id === 'lady-moon-fan-v1');
  const rainDetective = registry.skins.find((skin) => skin.id === 'cat-rain-detective-v1');
  const hotbloodCat = registry.skins.find((skin) => skin.id === 'cat-hotblood-v1');

  assert.deepEqual(defaultCat?.assets, {
    topLeft: 'themes/skin-default-top-left.png',
    bottomRight: 'themes/skin-default-bottom-right.png'
  });

  assert.deepEqual(suspenseCat?.assets, {
    topLeft: 'themes/skin-suspense-top-left.png',
    bottomRight: 'themes/skin-suspense-bottom-right.png'
  });
  assert.equal(suspenseCat?.name, '悬疑侦探 · 黑猫');
  assert.equal(suspenseCat?.motionAssets, undefined);

  assert.deepEqual(peachGuard?.assets, {
    topLeft: 'themes/skin-peach-guard-top-left.png',
    bottomRight: 'themes/skin-peach-guard-bottom-right.png'
  });
  assert.equal(peachGuard?.motionAssets, undefined);
  assert.equal(peachGuard?.assets?.topLeft.includes('skin-ancient'), false);
  assert.equal(peachGuard?.assets?.bottomRight.includes('skin-ancient'), false);
  assert.deepEqual(peachGuard?.palette, {
    primary: '#2f4a58',
    accent: '#d2a062',
    glow: '#f3d7c7'
  });

  assert.deepEqual(moonFan?.assets, {
    topLeft: 'themes/skin-moon-fan-top-left.png',
    bottomRight: 'themes/skin-moon-fan-bottom-right.png'
  });
  assert.equal(moonFan?.motionAssets, undefined);
  assert.equal(moonFan?.assets?.topLeft.includes('skin-ancient'), false);
  assert.equal(moonFan?.assets?.bottomRight.includes('skin-ancient'), false);
  assert.deepEqual(moonFan?.palette, {
    primary: '#5b4d7a',
    accent: '#d9c0a8',
    glow: '#f3dff7'
  });
  assert.doesNotMatch(moonFan?.description || '', /先复用 ancient 基础素材/);

  assert.deepEqual(rainDetective?.assets, {
    topLeft: 'themes/skin-rain-detective-top-left.png',
    bottomRight: 'themes/skin-rain-detective-bottom-right.png'
  });
  assert.equal(rainDetective?.motionAssets, undefined);
  assert.equal(rainDetective?.motionPreset, 'detective-cat');

  assert.deepEqual(hotbloodCat?.assets, {
    topLeft: 'themes/skin-hotblood-top-left.png',
    bottomRight: 'themes/skin-hotblood-bottom-right.png'
  });
  assert.equal(hotbloodCat?.assets?.topLeft.endsWith('.png'), true);
  assert.equal(hotbloodCat?.assets?.bottomRight.endsWith('.png'), true);
});

test('character skin checklist documents peach-guard template lock and moon-fan production asset names', () => {
  const checklist = readFileSync(
    resolve(process.cwd(), 'docs/design/AURA_CHARACTER_SKIN_ACCEPTANCE_CHECKLIST_V1.md'),
    'utf8'
  );

  assert.match(checklist, /general-peach-guard-v1/);
  assert.match(checklist, /skin-peach-guard-top-left\.png/);
  assert.match(checklist, /skin-peach-guard-bottom-right\.png/);
  assert.match(checklist, /lady-moon-fan-v1/);
  assert.match(checklist, /skin-moon-fan-top-left\.png/);
  assert.match(checklist, /Skin Studio/);
});

test('recommendSkinByText and resolveSkin prefer mapped character themes for matching context', () => {
  const registry = validateSkinRegistry(createRegistry(), { label: 'character-theme' });
  const recommended = recommendSkinByText(registry, '这部古装权谋剧里将军在桃林守望');
  assert.equal(recommended?.id, 'general-peach-guard-v1');

  const resolved = resolveSkin(registry, { themeMode: 'auto', selectedSkinId: '' }, '权谋 将军 桃林');
  assert.equal(resolved.skin?.id, 'general-peach-guard-v1');
  assert.equal(resolved.source, 'auto-character-theme');

  const ladyRecommended = recommendSkinByText(registry, '古偶氛围里贵女在月下执扇，花瓣和流苏都很轻');
  assert.equal(ladyRecommended?.id, 'lady-moon-fan-v1');
});

test('resolveMotionProfile binds character motion language into concrete motion profile patches', () => {
  const registry = validateSkinRegistry(createRegistry(), { label: 'character-theme' });
  const generalSkin = registry.skins.find((skin) => skin.id === 'general-peach-guard-v1');
  const ladySkin = registry.skins.find((skin) => skin.id === 'lady-moon-fan-v1');

  const generalProfile = resolveMotionProfile({
    skin: generalSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'playing',
      controlsVisible: false,
      adActive: false,
      attentionActive: false
    }
  });
  assert.equal(generalProfile.id, 'poetic-guard');
  assert.equal(generalProfile.motionState, 'idle-soft');
  assert.equal(generalProfile.topLeft.driftPx, 0);
  assert.equal(generalProfile.topLeft.tiltDeg, 0);
  assert.equal(generalProfile.bottomRight.driftPx, 0);
  assert.equal(generalProfile.bottomRight.liftPx, 0);
  assert.equal(generalProfile.bottomRight.probeXPx, 0);
  assert.equal(generalProfile.bottomRight.tiltDeg, 0);
  assert.ok(generalProfile.bottomRight.haloOpacity > 0);
  assert.ok(generalProfile.bottomRight.haloOpacity < 0.3);
  assert.equal(generalProfile.bottomRight.haloScale, 1);
  assert.ok(generalProfile.bottomRight.scalePeak > generalProfile.bottomRight.scaleFrom);
  assert.ok(generalProfile.bottomRight.scalePeak <= 1.018);

  const generalAttentionProfile = resolveMotionProfile({
    skin: generalSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'playing',
      controlsVisible: false,
      adActive: false,
      attentionActive: true
    }
  });
  assert.equal(generalAttentionProfile.motionState, 'attention-soft');
  assert.ok(generalAttentionProfile.root.sparkleOpacity > generalProfile.root.sparkleOpacity);
  assert.equal(generalAttentionProfile.bottomRight.probeXPx, 0);
  assert.ok(generalAttentionProfile.bottomRight.scalePeak > generalProfile.bottomRight.scalePeak);
  assert.ok(generalAttentionProfile.bottomRight.scalePeak <= 1.03);
  assert.ok(generalAttentionProfile.bottomRight.haloOpacity > generalProfile.bottomRight.haloOpacity);
  assert.ok(generalAttentionProfile.bottomRight.haloScale > generalProfile.bottomRight.haloScale);

  const generalControlsAttentionProfile = resolveMotionProfile({
    skin: generalSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'playing',
      controlsVisible: true,
      adActive: false,
      attentionActive: true
    }
  });
  assert.equal(generalControlsAttentionProfile.motionState, 'attention-soft');
  assert.equal(generalControlsAttentionProfile.bottomRight.probeXPx, 0);
  assert.ok(generalControlsAttentionProfile.bottomRight.haloOpacity > generalProfile.bottomRight.haloOpacity);

  const generalPausedProfile = resolveMotionProfile({
    skin: generalSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'paused',
      controlsVisible: false,
      adActive: false,
      attentionActive: false
    }
  });
  assert.equal(generalPausedProfile.motionState, 'paused-still');
  assert.equal(generalPausedProfile.bottomRight.probeXPx, 0);
  assert.ok(generalPausedProfile.bottomRight.scalePeak >= 1);
  assert.ok(generalPausedProfile.bottomRight.haloOpacity < generalProfile.bottomRight.haloOpacity);

  const generalPausedControlsProfile = resolveMotionProfile({
    skin: generalSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'paused',
      controlsVisible: true,
      adActive: false,
      attentionActive: true
    }
  });
  assert.equal(generalPausedControlsProfile.motionState, 'paused-still');
  assert.equal(generalPausedControlsProfile.bottomRight.probeXPx, 0);
  assert.ok(generalPausedControlsProfile.bottomRight.scalePeak >= 1);

  const generalControlsProfile = resolveMotionProfile({
    skin: generalSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'playing',
      controlsVisible: true,
      adActive: false,
      attentionActive: false
    }
  });
  assert.equal(generalControlsProfile.motionState, 'controls-softened');
  assert.ok(generalControlsProfile.bottomRight.scalePeak < generalProfile.bottomRight.scalePeak);
  assert.ok(generalControlsProfile.bottomRight.haloOpacity < generalProfile.bottomRight.haloOpacity);

  const generalAdProfile = resolveMotionProfile({
    skin: generalSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'playing',
      controlsVisible: false,
      adActive: true,
      attentionActive: true
    }
  });
  assert.equal(generalAdProfile.motionState, 'ad-muted');
  assert.equal(generalAdProfile.bottomRight.probeXPx, 0);
  assert.ok(generalAdProfile.bottomRight.scalePeak < generalControlsProfile.bottomRight.scalePeak);
  assert.equal(generalAdProfile.bottomRight.haloOpacity, 0);

  const ladyProfile = resolveMotionProfile({
    skin: ladySkin,
    mode: 'quiet',
    visualState: {
      playbackState: 'playing',
      controlsVisible: false,
      adActive: false,
      attentionActive: false
    }
  });
  assert.equal(ladyProfile.id, 'graceful');
  assert.ok(ladyProfile.bottomRight.probeXPx < 3.2);
  assert.ok(ladyProfile.topLeft.glintStrength > 1.04);
});

test('resolveMotionProfile gives suspense skin visible idle watch motion without replacement frames', () => {
  const suspenseSkin = {
    id: 'cat-suspense-v1',
    name: '悬疑侦探 · 黑猫',
    category: 'genre',
    description: '悬疑侦探 · 黑猫',
    match: { keywords: ['悬疑'] },
    assets: {
      topLeft: 'themes/skin-suspense-top-left.png',
      bottomRight: 'themes/skin-suspense-bottom-right.png'
    },
    palette: {
      primary: '#6f9fbd',
      accent: '#c69a5c',
      glow: '#79b7d4'
    },
    recommendedMode: 'standard',
    motionPreset: 'watchful',
    tags: ['悬疑']
  };

  const idleProfile = resolveMotionProfile({
    skin: suspenseSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'playing',
      controlsVisible: false,
      adActive: false,
      attentionActive: false
    }
  });

  assert.equal(idleProfile.motionState, 'idle-watch');
  assert.ok(idleProfile.bottomRight.probeXPx >= 0.85);
  assert.ok(idleProfile.bottomRight.probeXPx < 1);
  assert.ok(idleProfile.bottomRight.mistShiftPx >= 6);

  const attentionProfile = resolveMotionProfile({
    skin: suspenseSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'playing',
      controlsVisible: false,
      adActive: false,
      attentionActive: true
    }
  });

  assert.equal(attentionProfile.motionState, 'idle-watch');

  const controlsAttentionProfile = resolveMotionProfile({
    skin: suspenseSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'playing',
      controlsVisible: true,
      adActive: false,
      attentionActive: true
    }
  });

  assert.equal(controlsAttentionProfile.motionState, 'controls-softened');
  assert.ok(controlsAttentionProfile.bottomRight.probeXPx < attentionProfile.bottomRight.probeXPx);

  const pausedAttentionProfile = resolveMotionProfile({
    skin: suspenseSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'paused',
      controlsVisible: false,
      adActive: false,
      attentionActive: true
    }
  });

  assert.equal(pausedAttentionProfile.motionState, 'paused-still');
});

test('resolveMotionProfile gives rain detective restrained single-image behavior', () => {
  const rainDetectiveSkin = {
    id: 'cat-rain-detective-v1',
    name: '雨夜悬疑 · 黑猫侦探',
    category: 'genre',
    description: '雨夜悬疑黑猫侦探',
    match: { keywords: ['侦探'] },
    assets: {
      topLeft: 'themes/skin-rain-detective-top-left.png',
      bottomRight: 'themes/skin-rain-detective-bottom-right.png'
    },
    palette: {
      primary: '#6f9fbd',
      accent: '#c69a5c',
      glow: '#79b7d4'
    },
    recommendedMode: 'standard',
    motionPreset: 'detective-cat',
    tags: ['侦探']
  };

  const idleProfile = resolveMotionProfile({
    skin: rainDetectiveSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'playing',
      controlsVisible: false,
      adActive: false,
      attentionActive: false
    }
  });

  assert.equal(idleProfile.motionState, 'idle-watch');
  assert.ok(idleProfile.bottomRight.driftPx < 4);
  assert.ok(idleProfile.bottomRight.probeXPx < 4);

  const attentionProfile = resolveMotionProfile({
    skin: rainDetectiveSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'playing',
      controlsVisible: false,
      adActive: false,
      attentionActive: true
    }
  });

  assert.equal(attentionProfile.motionState, 'idle-watch');
  assert.ok(attentionProfile.bottomRight.probeXPx < 5);

  const pausedProfile = resolveMotionProfile({
    skin: rainDetectiveSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'paused',
      controlsVisible: false,
      adActive: false,
      attentionActive: false
    }
  });

  assert.equal(pausedProfile.motionState, 'paused-still');

  const adProfile = resolveMotionProfile({
    skin: rainDetectiveSkin,
    mode: 'standard',
    visualState: {
      playbackState: 'playing',
      controlsVisible: false,
      adActive: true,
      attentionActive: true
    }
  });

  assert.equal(adProfile.motionState, 'ad-muted');
});

test('info layer uses character theme semantic hint and restrained microcopy fallback', () => {
  const skin = createRegistry().skins[1];

  assert.equal(
    getTopLeftSemanticLabel({ showContext: '', skin }),
    '桃林守望'
  );

  const model = buildInfoLayerModel({
    skin,
    showContext: '',
    prompt: null,
    utilitySummary: {
      markCount: 2,
      recentMarkLabel: '12:30',
      resumePointLabel: '18:42'
    },
    playbackControl: {
      canReadTime: false,
      canSeek: false
    }
  });

  assert.deepEqual(model, {
    semanticLabel: '桃林守望',
    feedbackText: '',
    feedbackType: '',
    utilityLabel: '回看点 18:42',
    latestMarkLabel: '',
    latestMarkTimeSec: null,
    canMarkMoment: false,
    canReplayLatestMark: false,
    microcopyTone: 'restrained'
  });
});
