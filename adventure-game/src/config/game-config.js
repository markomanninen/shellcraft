const WORLD_ROOMS = {
  start: {
    id: 'start',
    name: 'Village Square',
    description: 'You stand in the center of a small village. To the north is a dark forest, to the east a mysterious cave, and to the south a peaceful meadow.',
    exits: { north: 'forest', east: 'cave', south: 'meadow' },
    items: ['torch', 'map']
  },
  forest: {
    id: 'forest',
    name: 'Dark Forest',
    description: 'Tall trees surround you, blocking most of the sunlight. You hear strange noises in the distance.',
    exits: { south: 'start', east: 'temple' },
    items: ['sword', 'shield']
  },
  cave: {
    id: 'cave',
    name: 'Mysterious Cave',
    description: 'The cave is damp and dark. You see ancient writings on the walls.',
    exits: { west: 'start', north: 'treasure' },
    items: ['potion']
  },
  meadow: {
    id: 'meadow',
    name: 'Peaceful Meadow',
    description: 'A beautiful meadow with wildflowers. You feel at peace here.',
    exits: { north: 'start' },
    items: ['flower', 'herbs']
  },
  temple: {
    id: 'temple',
    name: 'Ancient Temple',
    description: 'An ancient temple with mysterious runes. This place holds great power.',
    exits: { west: 'forest' },
    items: ['amulet']
  },
  treasure: {
    id: 'treasure',
    name: 'Treasure Chamber',
    description: 'You found the legendary treasure! Congratulations, adventurer!',
    exits: { south: 'cave' },
    items: ['gold', 'crown', 'jewels']
  }
};

const QUEST_DEFINITIONS = [
  {
    id: 'prove_worth',
    title: 'Earn the Elder Seal',
    description: 'Speak with the Village Elder and earn sanction for temple entry.',
    roomId: 'start',
    initialStatus: 'active',
    rewardItems: ['elder_seal']
  },
  {
    id: 'recover_amulet',
    title: 'Recover the Temple Amulet',
    description: 'Defeat the temple guardian and retrieve the ancient amulet.',
    roomId: 'temple',
    item: 'amulet',
    requiredItems: ['elder_seal'],
    requiredEncounterDefeated: 'temple_guardian',
    initialStatus: 'locked',
    unlocksWhenCompleted: 'prove_worth'
  },
  {
    id: 'claim_treasure',
    title: 'Claim the Treasure Chamber',
    description: 'Defeat the vault sentinel and claim the relics beyond it.',
    roomId: 'treasure',
    requiredItems: ['amulet', 'vault_key'],
    requiredEncounterDefeated: 'treasure_sentinel',
    initialStatus: 'locked',
    unlocksWhenCompleted: 'recover_amulet'
  }
];

const ENCOUNTER_DEFINITIONS = {
  forest_wolf: {
    id: 'forest_wolf',
    roomId: 'forest',
    name: 'Shadow Wolf',
    difficulty: 10,
    maxHp: 8,
    drops: ['wolf_pelt'],
    factionImpact: { forest_clans: 3 }
  },
  temple_guardian: {
    id: 'temple_guardian',
    roomId: 'temple',
    name: 'Runic Guardian',
    difficulty: 12,
    maxHp: 12,
    drops: ['guardian_core'],
    factionImpact: { temple_order: 6 }
  },
  treasure_sentinel: {
    id: 'treasure_sentinel',
    roomId: 'treasure',
    name: 'Vault Sentinel',
    difficulty: 14,
    maxHp: 14,
    drops: ['vault_key'],
    factionImpact: { temple_order: 8 }
  }
};

const NPC_DEFINITIONS = {
  village_elder: {
    id: 'village_elder',
    name: 'Village Elder',
    roomId: 'start',
    faction: 'villagers'
  },
  forest_ranger: {
    id: 'forest_ranger',
    name: 'Forest Ranger',
    roomId: 'forest',
    faction: 'forest_clans'
  },
  temple_keeper: {
    id: 'temple_keeper',
    name: 'Temple Keeper',
    roomId: 'temple',
    faction: 'temple_order'
  }
};

function deepFreeze(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }
  Object.getOwnPropertyNames(value).forEach((name) => {
    deepFreeze(value[name]);
  });
  return Object.freeze(value);
}

export const GAME_CONFIG = deepFreeze({
  app: {
    name: 'Terminal Adventure'
  },
  runtime: {
    ssh: {
      host: '0.0.0.0',
      port: 2222,
      hostKeyPath: './keys/host_key'
    },
    storage: {
      sessionsFile: './data/sessions.json'
    },
    llm: {
      baseUrl: 'http://localhost:11434',
      model: 'qwen3-coder:30b',
      timeoutMs: 60000,
      healthTimeoutMs: 3000
    }
  },
  terminal: {
    cols: 80,
    rows: 24
  },
  llm: {
    maxHistoryMessages: 40,
    requiredNarrationKeys: ['description', 'message'],
    descriptionMaxChars: 500,
    actionCount: {
      min: 4,
      max: 6
    },
    chatOptions: {
      temperature: 0.6,
      maxTokens: 900
    }
  },
  gameplay: {
    initialRoomId: 'start',
    freeTextLabel: 'Ask the Game Master...',
    backToMenuLabel: 'Back to menu',
    genericActions: ['Investigate surroundings', 'Wait and assess', 'Review objectives'],
    timePhases: ['dawn', 'morning', 'afternoon', 'dusk', 'night']
  },
  systems: {
    player: {
      maxHealth: 20,
      initialHealth: 20,
      minHealth: 1
    },
    skills: ['combat', 'lore', 'stealth', 'charisma', 'perception'],
    initialSkillScore: 2,
    skillDifficulty: {
      easy: 8,
      normal: 11,
      hard: 14
    },
    combat: {
      baseDamage: 2,
      defendDamage: 1,
      criticalBonus: 2,
      enemyCounterDamage: {
        success: 1,
        partial: 2,
        fail: 4
      }
    },
    factions: ['villagers', 'forest_clans', 'temple_order'],
    factionBounds: {
      min: -100,
      max: 100
    },
    pacing: {
      minTension: 0,
      maxTension: 100,
      initialTension: 25,
      beats: ['discovery', 'threat', 'setback', 'recovery', 'reveal']
    },
    directorStyles: ['balanced', 'grim', 'heroic', 'mystic'],
    defaultDirectorStyle: 'balanced'
  },
  world: {
    rooms: WORLD_ROOMS,
    quests: QUEST_DEFINITIONS,
    npcs: NPC_DEFINITIONS,
    encounters: ENCOUNTER_DEFINITIONS
  }
});

function validateGameConfig(config) {
  const minActions = config.llm.actionCount.min;
  const maxActions = config.llm.actionCount.max;
  if (minActions < 1 || minActions > maxActions) {
    throw new Error('[config] Invalid actionCount bounds in GAME_CONFIG');
  }

  if (!config.world.rooms[config.gameplay.initialRoomId]) {
    throw new Error('[config] gameplay.initialRoomId does not exist in world.rooms');
  }

  for (const room of Object.values(config.world.rooms)) {
    for (const exitId of Object.values(room.exits)) {
      if (!config.world.rooms[exitId]) {
        throw new Error(`[config] Room "${room.id}" has invalid exit "${exitId}"`);
      }
    }
  }

  const questIds = new Set(config.world.quests.map((quest) => quest.id));
  for (const quest of config.world.quests) {
    if (!config.world.rooms[quest.roomId]) {
      throw new Error(`[config] Quest "${quest.id}" references unknown room "${quest.roomId}"`);
    }
    if (quest.unlocksWhenCompleted && !questIds.has(quest.unlocksWhenCompleted)) {
      throw new Error(
        `[config] Quest "${quest.id}" unlock dependency "${quest.unlocksWhenCompleted}" does not exist`
      );
    }
    if (quest.requiredEncounterDefeated && !config.world.encounters[quest.requiredEncounterDefeated]) {
      throw new Error(
        `[config] Quest "${quest.id}" references unknown encounter "${quest.requiredEncounterDefeated}"`
      );
    }
  }

  for (const encounter of Object.values(config.world.encounters)) {
    if (!config.world.rooms[encounter.roomId]) {
      throw new Error(
        `[config] Encounter "${encounter.id}" references unknown room "${encounter.roomId}"`
      );
    }
    if (!Number.isInteger(encounter.maxHp) || encounter.maxHp < 1) {
      throw new Error(`[config] Encounter "${encounter.id}" has invalid maxHp`);
    }
  }
}

validateGameConfig(GAME_CONFIG);
