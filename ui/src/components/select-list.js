import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme, glyphs, textProps } from '../theme.js';
import { useSelection, useFollowSelection, stepIndex, scrollLayout } from '../selection.js';
import { MoreIndicator } from './scroll-view.js';

const h = React.createElement;

/**
 * One list row, stretched to the parent's width: 1 cell padding, a 2-cell
 * marker column, the label (truncated at the end) and the hint
 * right-aligned. Selected = accent bar, onAccent bold text, marker `›`.
 * Disabled = muted.
 */
export function ListItem({ label, hint, selected = false, disabled = false }) {
  const labelStyle = textProps(selected ? 'onAccent' : disabled ? 'muted' : 'default');
  const hintStyle = textProps(selected ? 'onAccent' : 'muted');
  return h(
    Box,
    {
      height: 1,
      flexShrink: 0,
      width: '100%',
      paddingX: 1,
      backgroundColor: selected ? theme.surface.accent : undefined
    },
    h(
      Box,
      { width: 2, flexShrink: 0 },
      h(Text, { ...labelStyle, bold: selected }, selected ? glyphs.marker : ' ')
    ),
    h(
      Box,
      { flexGrow: 1, flexShrink: 1, overflow: 'hidden' },
      h(Text, { ...labelStyle, bold: selected, wrap: 'truncate-end' }, label)
    ),
    hint !== undefined && hint !== null && hint !== ''
      ? h(
          Box,
          { flexShrink: 0, marginLeft: 1 },
          h(Text, { ...hintStyle, bold: selected }, String(hint))
        )
      : null
  );
}

/**
 * Keyboard list: ↑↓ (or k/j) move, ⏎ calls onSelect(index, item), number
 * keys 1-9 jump to that item. Disabled items are skipped.
 *
 * items: [{ label, hint, disabled }]
 * selectedIndex + onChange(index): controlled; without onChange the list
 *   keeps its own selection.
 * isActive: whether this list takes keys (the focused one).
 * focused: false shows the list without a selection bar and takes no keys,
 *   e.g. actions while the user types elsewhere or while waiting.
 * height: visible rows; longer lists scroll to keep the selection visible,
 *   with `↑ N more` / `↓ N more` in the first and last row.
 */
export function SelectList({
  items = [],
  selectedIndex,
  onChange,
  onSelect,
  isActive = true,
  focused = true,
  numberKeys = true,
  height
}) {
  const { index, ref, select } = useSelection(items.length, selectedIndex, onChange);

  useInput(
    (input, key) => {
      const current = ref.current;
      if (key.upArrow || input === 'k') {
        select(stepIndex(items, current, -1));
      } else if (key.downArrow || input === 'j') {
        select(stepIndex(items, current, +1));
      } else if (key.return) {
        const item = items[current];
        if (item && !item.disabled && onSelect) onSelect(current, item);
      } else if (numberKeys && /^[1-9]$/.test(input)) {
        const target = Number(input) - 1;
        if (target < items.length && !items[target].disabled) select(target);
      }
    },
    { isActive: isActive && focused && items.length > 0 }
  );

  const following = useFollowSelection(items.length, height, focused ? index : 0);
  const layout = height
    ? scrollLayout(items.length, height, following)
    : { offset: 0, count: items.length, above: 0, below: 0, top: false, bottom: false };
  const visible = items.slice(layout.offset, layout.offset + layout.count);

  return h(
    Box,
    { flexDirection: 'column', flexShrink: 0, width: '100%' },
    // Indicators line up with the labels (padding 1 + marker 2).
    layout.top ? h(MoreIndicator, { key: 'up', direction: 'up', count: layout.above, indent: 3 }) : null,
    ...visible.map((item, i) =>
      h(ListItem, {
        key: `${layout.offset + i}`,
        label: item.label,
        hint: item.hint,
        disabled: item.disabled,
        selected: focused && layout.offset + i === index
      })
    ),
    layout.bottom ? h(MoreIndicator, { key: 'down', direction: 'down', count: layout.below, indent: 3 }) : null
  );
}
