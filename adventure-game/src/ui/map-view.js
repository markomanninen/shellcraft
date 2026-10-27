/* adventure-game/src/ui/map-view.js */
import React from 'react';
import { Text, ScrollView, textProps } from '@shellcraft/ui';

const h = React.createElement;

export const MAP_LAYOUT = {
  forest: 'FOR',
  temple: 'TMP',
  treasure: 'TRS',
  start: 'VLG',
  cave: 'CAV',
  meadow: 'MDW'
};

const LEGEND = [
  '[FOR] Forest   [TMP] Temple',
  '[VLG] Village  [CAV] Cave',
  '[TRS] Treasure [MDW] Meadow'
];

/**
 * The regional map as rows of styled segments ([{ text, tone, bold }]):
 * visited rooms as `[FOR]`, the current one as `[ @ ]` (success), links
 * between visited rooms, unknown rooms blank. Same layout as before the
 * port; the blessed color tags became tones.
 */
export function mapRows(gameState) {
  const visited = (id) => Boolean(gameState?.visitedRooms?.has?.(id));
  const isCurrent = (id) => gameState?.currentRoom === id;

  const node = (id) => {
    if (isCurrent(id)) return { text: '[ @ ]', tone: 'success' };
    if (visited(id)) return { text: `[${MAP_LAYOUT[id] || '???'}]` };
    return { text: '     ' };
  };
  const hLink = (a, b, length = 1) => ({ text: (visited(a) && visited(b) ? '-' : ' ').repeat(length) });
  const vLink = (a, b) => ({ text: visited(a) && visited(b) ? '|' : ' ' });
  const gap = (n) => ({ text: ' '.repeat(n) });

  return [
    // [FOR]-[TMP]   [TRS]
    [node('forest'), hLink('forest', 'temple'), node('temple'), gap(3), node('treasure')],
    //   |             |
    [gap(2), vLink('forest', 'start'), gap(13), vLink('treasure', 'cave')],
    // [VLG]---------[CAV]
    [node('start'), hLink('start', 'cave', 9), node('cave')],
    //   |
    [gap(2), vLink('start', 'meadow')],
    // [MDW]
    [node('meadow')],
    [],
    [{ text: 'Legend', bold: true }],
    [{ text: '[ @ ]', tone: 'success' }, { text: ' You are here' }],
    ...LEGEND.map((line) => [{ text: line }])
  ];
}

/** Plain-text map (tests, logs). */
export function generateMap(gameState) {
  return mapRows(gameState).map((row) => row.map((s) => s.text).join('').replace(/\s+$/, '')).join('\n');
}

/** The map as ScrollView rows (↑↓ scroll when it does not fit). */
export function MapView({ gameState, isActive = false }) {
  const rows = mapRows(gameState).map((segments, i) =>
    h(
      Text,
      { key: `m${i}`, wrap: 'truncate-end' },
      segments.length === 0 ? ' ' : null,
      ...segments.map((s, j) => h(Text, { key: `${i}-${j}`, ...textProps(s.tone ?? 'default'), bold: Boolean(s.bold) }, s.text))
    )
  );
  return h(ScrollView, { rows, isActive });
}
