import React, { useState } from 'react';
import {
  Screen,
  Panel,
  TextField,
  Button,
  EmptyState,
  Box,
  useInput,
  useTerminalSize
} from '@shellcraft/ui';
import { CartSummary, cartMeta, plural } from './cart-summary.js';

const h = React.createElement;

export const FIELDS = [
  { name: 'name', label: 'Name', placeholder: 'Your name' },
  { name: 'email', label: 'Email', placeholder: 'you@example.com' },
  { name: 'address', label: 'Address', placeholder: 'Street, city' }
];
const BUTTON = FIELDS.length; // focus index of [ Place order ]

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Error message for one field, or null when it is fine. */
export function validateField(name, value) {
  const v = (value ?? '').trim();
  if (name === 'name') return v ? null : 'Enter your name';
  if (name === 'email') {
    if (!v) return 'Enter your email';
    return EMAIL.test(v) ? null : 'Enter a full address';
  }
  if (name === 'address') return v ? null : 'Enter a shipping address';
  return null;
}

export function validateForm(form) {
  const errors = {};
  for (const { name } of FIELDS) {
    const error = validateField(name, form[name]);
    if (error) errors[name] = error;
  }
  return errors;
}

const SHIPPING_HEIGHT = 10; // edge + padding + 3 fields × 2 rows + padding + edge

/**
 * Form template. Two modes, as before the port: move between fields with
 * ↑↓ and press ⏎ to edit one; while editing, ⏎ saves and esc cancels.
 * ⏎ on [ Place order ] validates and places the order. b goes back.
 */
export function CheckoutScreen({ ctx }) {
  const { session } = ctx;
  const cart = session.cart;
  const [form, setForm] = useState(() => ({ name: '', email: '', address: '', ...session.checkoutFormData }));
  const [errors, setErrors] = useState({});
  const [focus, setFocus] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const { rows } = useTerminalSize();

  const startEditing = () => {
    setDraft(form[FIELDS[focus].name] ?? '');
    setEditing(true);
    ctx.setTyping(true);
  };

  const stopEditing = () => {
    setEditing(false);
    ctx.setTyping(false);
  };

  const commit = (value) => {
    const { name } = FIELDS[focus];
    const next = { ...form, [name]: value };
    setForm(next);
    session.checkoutFormData = next;
    if (errors[name]) {
      // Re-check a field that was flagged, so a fix clears its error at once.
      const error = validateField(name, value);
      const nextErrors = { ...errors };
      if (error) nextErrors[name] = error;
      else delete nextErrors[name];
      setErrors(nextErrors);
      const left = Object.keys(nextErrors).length;
      if (left > 0) ctx.notify('error', `Fix ${plural(left, 'field')} before ordering`);
      else ctx.notify(null);
    }
    stopEditing();
  };

  const placeOrder = () => {
    const found = validateForm(form);
    setErrors(found);
    const invalid = FIELDS.findIndex((f) => found[f.name]);
    if (invalid !== -1) {
      const count = Object.keys(found).length;
      setFocus(invalid);
      ctx.notify('error', `Fix ${plural(count, 'field')} before ordering`);
      return;
    }
    ctx.placeOrder({ ...form });
  };

  useInput(
    (input, key) => {
      if (cart.length === 0) {
        if (input === 'b' || key.escape) ctx.navigate('home');
        return;
      }
      if (key.upArrow || input === 'k' || (key.tab && key.shift)) {
        setFocus((f) => Math.max(f - 1, 0));
      } else if (key.downArrow || input === 'j' || key.tab) {
        setFocus((f) => Math.min(f + 1, BUTTON));
      } else if (key.return) {
        if (focus === BUTTON) placeOrder();
        else startEditing();
      } else if (input === 'b' || key.escape) {
        ctx.navigate('cart');
      }
    },
    { isActive: !editing }
  );

  const meta = cartMeta(cart);

  if (cart.length === 0) {
    return h(
      Screen,
      { app: 'Demo Shop', screen: 'Checkout', meta, hints: [['b', 'back']], message: ctx.message },
      h(
        Panel,
        { title: 'Checkout', focused: true },
        h(EmptyState, { message: 'Your cart is empty.', hint: 'Add items before checkout:', k: 'b', label: 'back' })
      )
    );
  }

  const hints = editing
    ? [['⏎', 'save'], ['esc', 'cancel']]
    : [['↑↓', 'field'], ['⏎', focus === BUTTON ? 'place order' : 'edit'], ['b', 'back']];

  // Order panel rows: edges and padding (4), blank + total (2), blank + button (2).
  const orderHeight = Math.max(rows - 2 - SHIPPING_HEIGHT, 6);
  const maxLines = Math.max(orderHeight - 8, 1);

  return h(
    Screen,
    { app: 'Demo Shop', screen: 'Checkout', meta, hints, message: ctx.message },
    h(
      Panel,
      { title: 'Shipping', focused: focus !== BUTTON, height: SHIPPING_HEIGHT },
      ...FIELDS.map((field, i) =>
        h(
          Box,
          { key: field.name, height: 2, flexShrink: 0 },
          h(TextField, {
            label: field.label,
            placeholder: field.placeholder,
            value: editing && focus === i ? draft : form[field.name],
            error: errors[field.name],
            focused: focus === i,
            editing: editing && focus === i,
            onChange: setDraft,
            onSubmit: commit,
            onCancel: stopEditing
          })
        )
      )
    ),
    h(
      Panel,
      { title: 'Order', focused: focus === BUTTON },
      h(CartSummary, { cart, maxLines }),
      h(Box, { height: 1 }),
      h(Button, { label: 'Place order', focused: focus === BUTTON })
    )
  );
}
