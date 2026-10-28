import React, { useState } from 'react';
import { Screen, Panel, Table, TableRow, EmptyState, Box, useInput, useTerminalSize } from '@shellcraft/ui';
import { cartLines, cartMeta, cartTotal, money } from './cart-summary.js';

const h = React.createElement;

export const CART_COLUMNS = [
  { label: 'Product', width: 24, grow: true },
  { label: 'Qty', width: 5, align: 'right' },
  { label: 'Price', width: 9, align: 'right' },
  { label: 'Subtotal', width: 10, align: 'right' }
];

/** Table template with a total row: c checkout, x clear cart, b back. */
export function CartScreen({ ctx }) {
  const { cart } = ctx.session;
  const lines = cartLines(cart);
  const [index, setIndex] = useState(0);
  const { rows } = useTerminalSize();

  useInput((input, key) => {
    if (input === 'c') {
      if (cart.length > 0) ctx.navigate('checkout');
      else ctx.notify('warning', 'Cart is empty');
    } else if (input === 'x') {
      ctx.clearCart();
    } else if (input === 'b' || key.escape) {
      ctx.navigate('home');
    }
  });

  const body =
    lines.length === 0
      ? h(EmptyState, { message: 'Your cart is empty.', hint: 'Browse products from the menu:', k: 'b', label: 'back' })
      : h(
          Box,
          { flexDirection: 'column', flexGrow: 1 },
          h(Table, {
            columns: CART_COLUMNS,
            rows: lines.map((l) => [l.product.name, String(l.qty), money(l.product.price), money(l.subtotal)]),
            selectedIndex: index,
            onChange: setIndex,
            // title, top edge, header, blank, total, bottom edge, status
            height: Math.max(rows - 7, 1)
          }),
          h(Box, { height: 1 }),
          h(TableRow, { columns: CART_COLUMNS, cells: ['Total', '', '', money(cartTotal(cart))], bold: true })
        );

  return h(
    Screen,
    {
      app: 'Demo Shop',
      screen: 'Cart',
      meta: cartMeta(cart),
      hints: [['↑↓', 'move'], ['c', 'checkout'], ['x', 'clear cart'], ['b', 'back']],
      message: ctx.message
    },
    h(Panel, { title: 'Cart', focused: true, padding: 0 }, body)
  );
}
