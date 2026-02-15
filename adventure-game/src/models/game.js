export class GameModel {
  constructor() {
    this.rooms = {
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
  }

  getRoom(roomId) {
    return this.rooms[roomId];
  }

  getAllRooms() {
    return Object.values(this.rooms);
  }

  getWorldSeedText() {
    return Object.values(this.rooms).map(r =>
      `- ${r.name} (${r.id}): ${r.description} [Items: ${r.items.join(', ')}] [Exits: ${Object.entries(r.exits).map(([d, id]) => `${d}->${id}`).join(', ')}]`
    ).join('\n');
  }
}
