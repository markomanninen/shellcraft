import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { RulesEngine } from '../../src/models/rules-engine.js';
import { createInitialGameState } from '../../src/models/game-state.js';

describe('RulesEngine', () => {
  it('resolves start turn and initializes action options', () => {
    const engine = new RulesEngine();
    const gameState = createInitialGameState();

    const turn = engine.resolveTurn(gameState, '__start__');

    assert.strictEqual(turn.action.type, 'start');
    assert.strictEqual(gameState.isFirstTurn, false);
    assert.strictEqual(gameState.moves, 1);
    assert.ok(turn.actions.length >= 4);
  });

  it('completes prove_worth quest by talking to the village elder', () => {
    const engine = new RulesEngine();
    const gameState = createInitialGameState();
    gameState.isFirstTurn = false;
    gameState.player.skills.charisma = 10;

    const turn = engine.resolveTurn(gameState, 'Talk to village elder');

    assert.notStrictEqual(turn.outcome.status, 'fail');
    assert.strictEqual(gameState.worldState.quests.prove_worth.status, 'completed');
    assert.strictEqual(gameState.worldState.quests.recover_amulet.status, 'active');
    assert.ok(gameState.inventory.includes('elder_seal'));
  });

  it('blocks amulet pickup until guardian is defeated', () => {
    const engine = new RulesEngine();
    const gameState = createInitialGameState();
    gameState.isFirstTurn = false;
    gameState.currentRoom = 'temple';
    gameState.inventory.push('elder_seal');
    gameState.worldState.quests.recover_amulet.status = 'active';

    const turn = engine.resolveTurn(gameState, 'Take amulet');

    assert.strictEqual(turn.outcome.status, 'fail');
    assert.ok(!gameState.inventory.includes('amulet'));
  });

  it('resolves deterministic combat and defeat rewards', () => {
    const engine = new RulesEngine();
    const gameState = createInitialGameState();
    gameState.isFirstTurn = false;
    gameState.currentRoom = 'temple';
    gameState.player.skills.combat = 10;

    const guardian = gameState.worldState.encounters.temple_guardian;
    guardian.currentHp = 1;

    const turn = engine.resolveTurn(gameState, 'Attack Runic Guardian');

    assert.strictEqual(turn.outcome.status, 'success');
    assert.strictEqual(guardian.defeated, true);
    assert.ok(gameState.inventory.includes('guardian_core'));
    assert.ok(gameState.worldState.metrics.combatVictories >= 1);
  });

  it('completes claim_treasure when all combat and item requirements are met', () => {
    const engine = new RulesEngine();
    const gameState = createInitialGameState();
    gameState.isFirstTurn = false;
    gameState.currentRoom = 'treasure';
    gameState.inventory.push('amulet', 'vault_key');
    gameState.worldState.quests.claim_treasure.status = 'active';
    gameState.worldState.encounters.treasure_sentinel.defeated = true;

    const turn = engine.resolveTurn(gameState, 'Claim the treasure');

    assert.strictEqual(turn.gameOver, true);
    assert.strictEqual(gameState.worldState.quests.claim_treasure.status, 'completed');
    assert.ok(gameState.inventory.includes('gold'));
  });

  it('applies counter damage during unresolved combat', () => {
    const engine = new RulesEngine();
    const gameState = createInitialGameState();
    gameState.isFirstTurn = false;
    gameState.currentRoom = 'forest';
    gameState.player.skills.combat = 0;
    gameState.player.health = gameState.player.maxHealth;

    const turn = engine.resolveTurn(gameState, 'Attack Shadow Wolf');

    assert.ok(turn.outcome.combat);
    assert.ok(turn.outcome.combat.counterDamage >= 0);
    assert.ok(gameState.player.health <= gameState.player.maxHealth);
    assert.ok(gameState.worldState.metrics.damageTaken >= turn.outcome.combat.counterDamage);
  });
});
