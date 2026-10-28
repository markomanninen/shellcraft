import React, { useRef } from 'react';
import { Box, Text, useInput, useBoxMetrics } from 'ink';
import { glyphs, textProps, borderTextProps } from '../theme.js';
import { textWidth, splitAtWidth, tailToWidth } from '../text.js';

const h = React.createElement;

// Control characters (C0, DEL, C1) never become part of a value.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

const chars = (s) => Array.from(s ?? '');

/**
 * Label column (11 cells, muted) + value (30 cells, underlined). Focus turns
 * the label and underline accent; while editing the field shows the cursor `█`
 * and takes keys. An error turns label and underline red and adds one line
 * under the value: `✗ message`, indented to the value column.
 *
 * editing defaults to focused. A form that has a "move between fields"
 * mode passes focused with editing={false} for the highlighted field.
 *
 * Keys while editing (only when onChange is given): printable text is
 * appended, backspace/delete removes the last character, ⏎ calls
 * onSubmit(value), esc calls onCancel(). The cursor stays at the end (no
 * ←/→ editing).
 *
 * Widths in cells: labelWidth (11; 0 for no label column) and valueWidth
 * (30, or 'fill' for the rest of the row, e.g. a free-text prompt across a
 * panel). A value longer than the field scrolls: while editing the end
 * stays in view (`…` + tail + cursor), otherwise it is cut with `…`.
 */
export function TextField({
  label,
  value = '',
  focused = false,
  editing = focused,
  error,
  placeholder = '',
  onChange,
  onSubmit,
  onCancel,
  labelWidth = 11,
  valueWidth = 30
}) {
  const valueRef = useRef(value);
  valueRef.current = value;

  const change = (next) => {
    valueRef.current = next;
    onChange(next);
  };

  useInput(
    (input, key) => {
      if (key.return) {
        onSubmit?.(valueRef.current);
        return;
      }
      if (key.escape) {
        onCancel?.();
        return;
      }
      if (key.backspace || key.delete) {
        const c = chars(valueRef.current);
        if (c.length > 0) change(c.slice(0, -1).join(''));
        return;
      }
      if (key.ctrl || key.meta || key.tab || key.upArrow || key.downArrow ||
          key.leftArrow || key.rightArrow || key.pageUp || key.pageDown ||
          key.home || key.end) {
        return;
      }
      const text = String(input ?? '').replace(CONTROL, '');
      if (text) change(valueRef.current + text);
    },
    { isActive: Boolean(editing && focused && onChange) }
  );

  const fillRef = useRef(null);
  const metrics = useBoxMetrics(fillRef);
  const fills = valueWidth === 'fill';
  const cells = fills ? (metrics.hasMeasured ? metrics.width : 0) : Math.max(Number(valueWidth) || 0, 0);

  const hasError = Boolean(error);
  const showCursor = Boolean(focused && editing);
  const state = hasError ? 'danger' : focused ? 'focus' : 'default';
  // Label: bold red / bold cyan, or muted (dim, never bold + dim).
  const labelProps = { ...textProps(hasError ? 'danger' : focused ? 'accent' : 'muted'), bold: hasError || focused };
  // The rest of the underline takes the border color of the state.
  const lineProps = borderTextProps(state);

  // Value cells: text, optional cursor, then underlined spaces up to the width.
  const room = Math.max(cells - (showCursor ? 1 : 0), 0);
  let shown;
  let shownProps = textProps('default');
  if (value === '') {
    shown = showCursor ? '' : splitAtWidth(placeholder, room)[0];
    shownProps = textProps('muted');
  } else if (textWidth(value) <= room) {
    shown = value;
  } else if (showCursor) {
    // Editing: keep the end of the value (where the cursor is) in view.
    shown = room > 1 ? '…' + tailToWidth(value, room - 1) : '';
  } else {
    shown = room > 1 ? splitAtWidth(value, room - 1)[0] + '…' : '';
  }
  const fill = Math.max(cells - textWidth(shown) - (showCursor ? 1 : 0), 0);

  return h(
    Box,
    // 'fill' takes the parent's width, in a row as in a column.
    { flexDirection: 'column', flexShrink: 0, ...(fills ? { width: '100%' } : {}) },
    h(
      Box,
      { height: 1 },
      labelWidth > 0
        ? h(
            Box,
            { width: labelWidth, flexShrink: 0, overflow: 'hidden' },
            h(Text, { ...labelProps, wrap: 'truncate-end' }, label)
          )
        : null,
      h(
        Box,
        fills
          ? { ref: fillRef, flexGrow: 1, flexShrink: 1, flexBasis: 0, overflow: 'hidden' }
          : { width: cells, flexShrink: 0, overflow: 'hidden' },
        h(
          Text,
          { wrap: 'truncate-end' },
          shown ? h(Text, { ...shownProps, underline: true }, shown) : null,
          showCursor ? h(Text, textProps('accent'), glyphs.cursor) : null,
          fill > 0 ? h(Text, { ...lineProps, underline: true }, ' '.repeat(fill)) : null
        )
      )
    ),
    hasError
      ? h(
          Box,
          { height: 1, paddingLeft: labelWidth },
          h(Text, { ...textProps('danger'), wrap: 'truncate-end' }, `${glyphs.error} ${error}`)
        )
      : null
  );
}
