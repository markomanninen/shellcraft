import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme, glyphs } from '../theme.js';
import { useSelection, stepIndex, windowStart } from '../selection.js';

const h = React.createElement;

/**
 * One list row, stretched to the parent's width: 1 cell padding, a 2-cell
 * marker column, the label (truncated at the end) and the hint
 * right-aligned. Selected = accent bar, onAccent bold text, marker `›`.
 * Disabled = muted.
 */
export function ListItem({ label, hint, selected = false, disabled = false }) {
  const textColor = selected ? theme.text.onAccent : disabled ? theme.text.muted : theme.text.default;
  const hintColor = selected ? theme.text.onAccent : theme.text.muted;
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
      h(Text, { color: textColor, bold: selected }, selected ? glyphs.marker : ' ')
    ),
    h(
      Box,
      { flexGrow: 1, flexShrink: 1, overflow: 'hidden' },
      h(Text, { color: textColor, bold: selected, wrap: 'truncate-end' }, label)
    ),
    hint !== undefined && hint !== null && hint !== ''
      ? h(
          Box,
          { flexShrink: 0, marginLeft: 1 },
          h(Text, { color: hintColor, bold: selected }, String(hint))
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
 * height: visible rows; longer lists scroll to keep the selection visible.
 */
export function SelectList({
  items = [],
  selectedIndex,
  onChange,
  onSelect,
  isActive = true,
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
    { isActive: isActive && items.length > 0 }
  );

  const start = windowStart(items.length, index, height);
  const visible = height ? items.slice(start, start + height) : items;

  return h(
    Box,
    { flexDirection: 'column', flexShrink: 0, width: '100%' },
    ...visible.map((item, i) =>
      h(ListItem, {
        key: `${start + i}`,
        label: item.label,
        hint: item.hint,
        disabled: item.disabled,
        selected: start + i === index
      })
    )
  );
}
