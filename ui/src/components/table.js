import React, { useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme, textProps } from '../theme.js';
import { useSelection, useFollowSelection, scrollLayout, maxScrollOffset } from '../selection.js';
import { MoreIndicator } from './scroll-view.js';

const h = React.createElement;

/**
 * One table row: 1 cell padding, cells at fixed widths with one space
 * between them, no rules. Cells truncate at their width; align 'right'
 * for numbers. A column with grow: true takes the spare width.
 *
 * variant: 'header' (muted, underlined) | 'default' | 'selected'
 * bold: bold cells (e.g. a total row).
 *
 * The header is dim + underline, not bold: bold and dim together show as
 * only one of them on terminals with a single intensity attribute.
 */
export function TableRow({ columns, cells = [], variant = 'default', bold = false }) {
  const selected = variant === 'selected';
  const header = variant === 'header';
  const cellStyle = textProps(selected ? 'onAccent' : header ? 'muted' : 'default');
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
      const label = value === undefined || value === null ? '' : String(value);
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
            ...cellStyle,
            bold: !header && (bold || selected),
            underline: header && label !== '',
            wrap: 'truncate-end'
          },
          label
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
 * height: body rows (the header is extra and stays). Longer tables scroll:
 *   with the selection kept in view, or, without a selection bar, with
 *   ↑↓ PgUp PgDn Home End. Hidden rows show as `↑ N more` / `↓ N more`
 *   in the first and last body row.
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
  const following = useFollowSelection(rows.length, height, selectable ? index : -1);
  // Without a selection bar the keys scroll the rows themselves.
  const [scrolled, setScrolled] = useState(0);
  const scrolledRef = useRef(0);
  const total = rows.length;
  const max = height ? maxScrollOffset(total, height) : 0;
  const scrollBy = (next) => {
    const o = Math.min(Math.max(next, 0), max);
    scrolledRef.current = o;
    setScrolled(o);
  };

  useInput(
    (input, key) => {
      if (selectable) {
        const current = ref.current;
        if (key.upArrow || input === 'k') select(current - 1);
        else if (key.downArrow || input === 'j') select(current + 1);
        else if (key.pageUp) select(current - Math.max((height ?? total) - 2, 1));
        else if (key.pageDown) select(current + Math.max((height ?? total) - 2, 1));
        else if (key.home) select(0);
        else if (key.end) select(total - 1);
        else if (key.return && onSelect && current >= 0) onSelect(current, rows[current]);
        return;
      }
      const o = scrolledRef.current;
      const page = Math.max((height ?? 0) - 2, 1);
      if (key.upArrow || input === 'k') scrollBy(o - 1);
      else if (key.downArrow || input === 'j') scrollBy(o + 1);
      else if (key.pageUp) scrollBy(o - page);
      else if (key.pageDown) scrollBy(o + page);
      else if (key.home) scrollBy(0);
      else if (key.end) scrollBy(max);
    },
    { isActive: isActive && total > 0 && (selectable || max > 0) }
  );

  const layout = height
    ? scrollLayout(total, height, selectable ? following : Math.min(scrolled, max))
    : { offset: 0, count: total, above: 0, below: 0, top: false, bottom: false };
  const visible = rows.slice(layout.offset, layout.offset + layout.count);

  return h(
    Box,
    { flexDirection: 'column', flexShrink: 0, width: '100%' },
    h(TableRow, { columns, cells: columns.map((c) => c.label), variant: 'header' }),
    layout.top ? h(MoreIndicator, { key: 'up', direction: 'up', count: layout.above, indent: 1 }) : null,
    ...visible.map((cells, i) =>
      h(TableRow, {
        key: `${layout.offset + i}`,
        columns,
        cells,
        variant: selectable && layout.offset + i === index ? 'selected' : 'default'
      })
    ),
    layout.bottom ? h(MoreIndicator, { key: 'down', direction: 'down', count: layout.below, indent: 1 }) : null
  );
}
