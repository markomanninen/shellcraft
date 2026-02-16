import { GAME_CONFIG } from '../config/game-config.js';

export class GameModel {
  constructor() {
    this.rooms = JSON.parse(JSON.stringify(GAME_CONFIG.world.rooms));
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
