import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { useSelection, windowStart } from '../selection.js';

const h = React.createElement;

/**
 * One table row: 1 cell padding, cells at fixed widths with one space
 * between them, no rules. Cells truncate at their width; align 'right'
 * for numbers. A column with grow: true takes the spare width.
 *
 * variant: 'header' (bold muted underlined) | 'default' | 'selected'
 * bold: bold cells (e.g. a total row).
 */
export function TableRow({ columns, cells = [], variant = 'default', bold = false }) {
  const selected = variant === 'selected';
  const header = variant === 'header';
  const color = selected ? theme.text.onAccent : header ? theme.text.muted : theme.text.default;
  return h(
    Box,
    {
      height: 1,
      flexShrink: 0,
      width: '100%',
      paddingX: 1,
      backgroundColor: selected ? theme.surface.accent : undefined
    },
    ...columns.map((column, i) => {
      const value = cells[i];
      const text = value === undefined || value === null ? '' : String(value);
      return h(
        Box,
        {
          key: `${i}`,
          width: column.width,
          flexShrink: 0,
          flexGrow: column.grow ? 1 : 0,
          marginRight: i < columns.length - 1 ? 1 : 0,
          justifyContent: column.align === 'right' ? 'flex-end' : 'flex-start',
          overflow: 'hidden'
        },
        h(
          Text,
          {
            color,
            bold: bold || selected || header,
            underline: header && text !== '',
            wrap: 'truncate-end'
          },
          text
        )
      );
    })
  );
}

/**
 * Header + rows. ↑↓ (or k/j) move the selection, ⏎ calls onSelect(index).
 *
 * columns: [{ label, width, align: 'left'|'right', grow }]
 * rows: [[cell, ...], ...]
 * selectedIndex + onChange(index): controlled; without onChange the table
 *   keeps its own selection. selectedIndex -1 or selectable={false}: no
 *   selection bar.
 * height: visible body rows; longer tables scroll with the selection.
 */
export function Table({
  columns = [],
  rows = [],
  selectedIndex,
  onChange,
  onSelect,
  isActive = true,
  selectable = selectedIndex !== -1,
  height
}) {
  const { index, ref, select } = useSelection(rows.length, selectedIndex, onChange);

  useInput(
    (input, key) => {
      const current = ref.current;
      if (key.upArrow || input === 'k') select(current - 1);
      else if (key.downArrow || input === 'j') select(current + 1);
      else if (key.return && onSelect && current >= 0) onSelect(current, rows[current]);
    },
    { isActive: isActive && selectable && rows.length > 0 }
  );

  const start = windowStart(rows.length, index, height);
  const visible = height ? rows.slice(start, start + height) : rows;

  return h(
    Box,
    { flexDirection: 'column', flexShrink: 0, width: '100%' },
    h(TableRow, { columns, cells: columns.map((c) => c.label), variant: 'header' }),
    ...visible.map((cells, i) =>
      h(TableRow, {
        key: `${start + i}`,
        columns,
        cells,
        variant: selectable && start + i === index ? 'selected' : 'default'
      })
    )
  );
}
