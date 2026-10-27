import React, { useRef, useState } from 'react';
import { useApp, useInput } from '@shellcraft/ui';
import { ProductModel } from '../models/product.js';
import { HomeScreen } from './home.js';
import { ProductsScreen } from './products.js';
import { CartScreen } from './cart.js';
import { CheckoutScreen } from './checkout.js';
import { cartTotal, money, plural } from './cart-summary.js';

const h = React.createElement;

export const screens = {
  home: HomeScreen,
  products: ProductsScreen,
  cart: CartScreen,
  checkout: CheckoutScreen
};

/**
 * The shop for one SSH session. Holds the current screen and the status
 * bar message; screens get a `ctx` to navigate, show messages and change
 * the cart. The cart lives in the session object (session.cart), as before.
 *
 * q quits from every screen except while a text field is being edited.
 */
export function ShopApp({ session, initialScreen = 'home', products = new ProductModel() }) {
  const { exit } = useApp();
  const [route, setRoute] = useState({ name: initialScreen, visit: 0 });
  const [message, setMessage] = useState(null);
  const [typing, setTyping] = useState(false);
  const [, setVersion] = useState(0);
  const visits = useRef(0);

  // session.cart is mutated in place (other code may hold the session), so
  // changes to it are followed by a re-render.
  const refresh = () => setVersion((v) => v + 1);

  useInput(
    (input, key) => {
      if (input === 'q' && !key.ctrl && !key.meta) exit();
    },
    { isActive: !typing }
  );

  const ctx = {
    session,
    products,
    message,
    navigate(name) {
      visits.current += 1;
      setRoute({ name: screens[name] ? name : 'home', visit: visits.current });
      setMessage(null);
      setTyping(false);
    },
    /** Show a status bar message; notify(null) clears it. */
    notify(tone, text) {
      setMessage(tone ? { tone, text } : null);
    },
    setTyping,
    addToCart(product) {
      session.cart.push(product);
      refresh();
      setMessage({ tone: 'success', text: `Added ${product.name} to cart` });
    },
    clearCart() {
      const had = session.cart.length;
      session.cart = [];
      refresh();
      setMessage(had ? { tone: 'info', text: 'Cart cleared' } : { tone: 'info', text: 'Cart is already empty' });
    },
    placeOrder(shipping) {
      const count = session.cart.length;
      const total = cartTotal(session.cart);
      session.orders = [...(session.orders ?? []), { items: session.cart, total, shipping, placedAt: new Date() }];
      session.cart = [];
      delete session.checkoutFormData;
      ctx.navigate('home');
      setMessage({ tone: 'success', text: `Order placed: ${plural(count, 'item')}, ${money(total)}` });
    },
    quit: exit
  };

  const Current = screens[route.name] ?? HomeScreen;
  return h(Current, { key: `${route.name}-${route.visit}`, ctx });
}
