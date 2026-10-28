import React, { useState } from 'react';
import { Screen, Panel, SelectList, EmptyState, Box } from '@shellcraft/ui';
import { CartSummary, cartMeta } from './cart-summary.js';

const h = React.createElement;

const MENU = [
  { label: 'Browse products', hint: '1', screen: 'products' },
  { label: 'View cart', hint: '2', screen: 'cart' },
  { label: 'Checkout', hint: '3', screen: 'checkout' }
];

/**
 * Menu + detail: the menu panel has focus, the detail panel shows the cart.
 * No Exit item: q quits.
 */
export function HomeScreen({ ctx }) {
  const [index, setIndex] = useState(0);
  const { cart } = ctx.session;

  return h(
    Screen,
    {
      app: 'Demo Shop',
      screen: 'Home',
      meta: cartMeta(cart),
      hints: [['↑↓', 'move'], ['⏎', 'select'], ['1-3', 'jump'], ['q', 'quit']],
      message: ctx.message
    },
    h(
      Box,
      { flexGrow: 1 },
      h(
        Panel,
        { title: 'Menu', focused: true, width: 30, padding: 0 },
        h(SelectList, {
          items: MENU,
          selectedIndex: index,
          onChange: setIndex,
          onSelect: (_i, item) => ctx.navigate(item.screen)
        })
      ),
      h(
        Panel,
        { title: 'Cart' },
        cart.length === 0
          ? h(EmptyState, {
              message: 'Your cart is empty.',
              hint: 'Browse products and press',
              k: 'a',
              label: 'add to cart'
            })
          : h(CartSummary, { cart })
      )
    )
  );
}
