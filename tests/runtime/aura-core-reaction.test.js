import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createCompanionSeed,
  createReactionController,
  resolveReactionAction
} from '../../packages/aura-core/src/reaction-core.js';

describe('aura-core reaction contract', () => {
  it('normalizes unknown atmosphere and intensity values', () => {
    const action = resolveReactionAction({
      atmosphereState: 'monologue',
      intensity: 'cinematic',
      skinId: 'cat-default-v1'
    });

    assert.equal(action.atmosphereState, 'idle');
    assert.equal(action.intensity, 'standard');
    assert.equal(action.action, 'idle-breathe');
  });

  it('applies reduced motion without removing the reaction semantics', () => {
    const lively = resolveReactionAction({
      atmosphereState: 'scare',
      intensity: 'lively',
      skinId: 'cat-hotblood-v1'
    });
    const reduced = resolveReactionAction({
      atmosphereState: 'scare',
      intensity: 'lively',
      skinId: 'cat-hotblood-v1',
      reducedMotion: true
    });

    assert.equal(reduced.action, 'short-flinch');
    assert.equal(reduced.motion, 'reduced');
    assert.ok(reduced.halo < lively.halo);
  });

  it('keeps repeated strong reactions behind cooldown', () => {
    let time = 1000;
    const controller = createReactionController({
      skinId: 'cat-rain-detective-v1',
      intensity: 'standard',
      now: () => time
    });

    const first = controller.next('scare');
    time += 1000;
    const second = controller.next('scare');
    time = first.cooldownUntilMs + 1;
    const third = controller.next('scare');

    assert.equal(first.heldByCooldown, false);
    assert.equal(second.heldByCooldown, true);
    assert.equal(second.action, 'short-flinch');
    assert.equal(third.heldByCooldown, false);
  });

  it('creates deterministic non-secret companion seeds', () => {
    assert.equal(createCompanionSeed('default-cat'), createCompanionSeed('default-cat'));
    assert.notEqual(createCompanionSeed('default-cat'), createCompanionSeed('rain-cat'));
  });
});
