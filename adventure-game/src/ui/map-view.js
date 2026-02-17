/* adventure-game/src/ui/map-view.js */
export const MAP_LAYOUT = {
  forest: 'FOR',
  temple: 'TMP',
  treasure: 'TRS',
  start: 'VLG',
  cave: 'CAV',
  meadow: 'MDW'
};

export function generateMap(gameState) {
  // Helper to check if a room has been visited
  const visited = (id) => gameState.visitedRooms && gameState.visitedRooms.has(id);
  // Helper to check if a room is the current one
  const isCurrent = (id) => gameState.currentRoom === id;

  // Renders a node: [XXX], [ @ ] (green), or empty space
  const renderNode = (id) => {
    if (isCurrent(id)) {
      return '{green-fg}[ @ ]{/}';
    }
    if (visited(id)) {
      const label = MAP_LAYOUT[id] || '???';
      return `[${label}]`;
    }
    return '     ';
  };

  const renderHLink = (id1, id2, length = 1) => {
    if (visited(id1) && visited(id2)) {
      return '-'.repeat(length);
    }
    return ' '.repeat(length);
  };

  const renderVLink = (id1, id2) => {
    if (visited(id1) && visited(id2)) {
      return '|';
    }
    return ' ';
  };

  // Row 0: [FOR]-[TMP]   [TRS]
  const row0 = 
    renderNode('forest') + 
    renderHLink('forest', 'temple', 1) + 
    renderNode('temple') + 
    '   ' + 
    renderNode('treasure');

  // Row 1:   |             |
  // Align pipes: [FOR] center is at index 2. [TRS] center is at index 16.
  const row1 = 
    '  ' + renderVLink('forest', 'start') + 
    '             ' + 
    renderVLink('treasure', 'cave') + '  ';

  // Row 2: [VLG]---------[CAV]
  const row2 = 
    renderNode('start') + 
    renderHLink('start', 'cave', 9) + 
    renderNode('cave');

  // Row 3:   |
  const row3 = 
    '  ' + renderVLink('start', 'meadow') + '                ';

  // Row 4: [MDW]
  const row4 = 
    renderNode('meadow') + '              ';

  const mapArt = [row0, row1, row2, row3, row4].join('\n');

  const legend = `
  {bold}Legend:{/}
  [ @ ] You are here
  [FOR] Forest   [TMP] Temple
  [VLG] Village  [CAV] Cave
  [TRS] Treasure [MDW] Meadow
  `;

  return mapArt + '\n' + legend;
}
