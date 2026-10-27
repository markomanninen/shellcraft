import React, { useState } from 'react';
import { Screen, Panel, Table, useInput, useTerminalSize } from '@shellcraft/ui';
import { cartMeta, money } from './cart-summary.js';

const h = React.createElement;

export const PRODUCT_COLUMNS = [
  { label: 'ID', width: 10 },
  { label: 'Name', width: 24 },
  { label: 'Description', width: 30, grow: true },
  { label: 'Price', width: 9, align: 'right' }
];

/** Table template: ↑↓ move, a add to cart, c cart, b back. */
export function ProductsScreen({ ctx }) {
  const products = ctx.products.getAll();
  const [index, setIndex] = useState(0);
  const { rows } = useTerminalSize();

  useInput((input, key) => {
    if (input === 'a') {
      const product = products[index];
      if (product) ctx.addToCart(product);
    } else if (input === 'c') {
      ctx.navigate('cart');
    } else if (input === 'b' || key.escape) {
      ctx.navigate('home');
    }
  });

  return h(
    Screen,
    {
      app: 'Demo Shop',
      screen: 'Products',
      meta: cartMeta(ctx.session.cart),
      hints: [['↑↓', 'move'], ['a', 'add to cart'], ['c', 'cart'], ['b', 'back']],
      message: ctx.message
    },
    h(
      Panel,
      { title: 'Products', focused: true, padding: 0 },
      h(Table, {
        columns: PRODUCT_COLUMNS,
        rows: products.map((p) => [p.id, p.name, p.description, money(p.price)]),
        selectedIndex: index,
        onChange: setIndex,
        // title, top edge, header, bottom edge, status
        height: Math.max(rows - 5, 1)
      })
    )
  );
}
