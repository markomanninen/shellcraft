import React from 'react';
import { Box, Text, textProps } from '@shellcraft/ui';

const h = React.createElement;

export const money = (amount) => `$${amount.toFixed(2)}`;

export const cartTotal = (cart) => cart.reduce((sum, item) => sum + item.price, 0);

/** Cart lines grouped by product, in the order they were first added. */
export function cartLines(cart) {
  const lines = new Map();
  for (const product of cart) {
    const line = lines.get(product.id);
    if (line) line.qty += 1;
    else lines.set(product.id, { product, qty: 1 });
  }
  return [...lines.values()].map((line) => ({ ...line, subtotal: line.qty * line.product.price }));
}

/** Title bar meta: "cart: 3 · $69.97" or "cart: empty". */
export const cartMeta = (cart) =>
  cart.length === 0 ? 'cart: empty' : `cart: ${cart.length} · ${money(cartTotal(cart))}`;

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const LABEL_WIDTH = 24;

// Product lines: muted name, default value. The total: both bold, and the
// label not muted, because bold + dim shows as only one of them on some
// terminals.
function Row({ label, value, bold = false }) {
  return h(
    Box,
    { height: 1, flexShrink: 0 },
    h(
      Box,
      { width: LABEL_WIDTH, flexShrink: 0, overflow: 'hidden' },
      h(Text, { ...textProps(bold ? 'default' : 'muted'), bold, wrap: 'truncate-end' }, label)
    ),
    h(Text, { ...textProps('default'), bold, wrap: 'truncate-end' }, value)
  );
}

/**
 * "Developer Blend   2 × $24.99" lines, a blank line and the total, as in
 * the Order panel of the Figma Form template. maxLines caps the product
 * lines; the rest is summed up in a "+ n more" line.
 */
export function CartSummary({ cart, maxLines = Infinity }) {
  const lines = cartLines(cart);
  let shown = lines;
  let hidden = [];
  if (lines.length > maxLines) {
    shown = lines.slice(0, Math.max(maxLines - 1, 0));
    hidden = lines.slice(shown.length);
  }
  return h(
    Box,
    { flexDirection: 'column', flexShrink: 0 },
    ...shown.map((line) =>
      h(Row, { key: line.product.id, label: line.product.name, value: `${line.qty} × ${money(line.product.price)}` })
    ),
    hidden.length > 0
      ? h(Row, {
          key: 'more',
          label: `+ ${plural(hidden.length, 'more product')}`,
          value: `${hidden.reduce((n, l) => n + l.qty, 0)} × …`
        })
      : null,
    h(Box, { key: 'gap', height: 1 }),
    h(Row, { key: 'total', label: 'Total', value: money(cartTotal(cart)), bold: true })
  );
}
