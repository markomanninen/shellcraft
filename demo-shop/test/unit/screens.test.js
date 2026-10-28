import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'assert';
import React from 'react';
import { renderTerminal, cleanupTerminals, styleAt, boldDimText, tick } from '@shellcraft/ui/testing';
import { ShopApp } from '../../src/ui/app.js';
import { SessionManager } from '../../src/server/session.js';
import { ProductModel } from '../../src/models/product.js';
import { validateField, validateForm } from '../../src/ui/checkout.js';

const h = React.createElement;

afterEach(() => cleanupTerminals());

function open({ columns = 80, rows = 24, session = new SessionManager().createSession(null) } = {}) {
  const t = renderTerminal(h(ShopApp, { session }), { columns, rows });
  return { t, session };
}

const width = (line) => Array.from(line).length;

/** Every frame is a full screen: title on row 0, status on the last row. */
function assertScreen(t, columns, rows, screen) {
  const lines = t.lines();
  assert.equal(lines.length, rows, `${screen}: ${rows} rows`);
  for (const [i, line] of lines.entries()) {
    assert.ok(width(line) <= columns, `${screen}: row ${i} is ${width(line)} wide: "${line}"`);
  }
  assert.ok(lines[0].startsWith(` Demo Shop › ${screen}`), `row 0: "${lines[0]}"`);
  assert.ok(lines[1].startsWith('╭─ '), `row 1: "${lines[1]}"`);
  assert.ok(lines[rows - 2].startsWith('╰'), `row ${rows - 2}: "${lines[rows - 2]}"`);
  assert.equal(boldDimText(t.lastFrame()), '', `${screen}: nothing is bold and dim at once`);
  return lines;
}

const statusRow = (t) => t.lines().at(-1);
const typeText = (t, text) => t.press(...Array.from(text));

describe('Shop screens (80x24)', () => {
  it('home: menu panel focused, cart detail, q quits hint', async () => {
    const { t } = open();
    await tick(20);
    const lines = assertScreen(t, 80, 24, 'Home');
    assert.ok(lines[0].endsWith('cart: empty'));
    assert.ok(lines[1].startsWith('╭─ Menu ─'));
    assert.ok(lines[1].includes('╮╭─ Cart ─'));
    assert.ok(lines[2].startsWith('│ › Browse products        1 │'));
    assert.ok(lines[3].startsWith('│   View cart              2 │'));
    assert.ok(lines[4].startsWith('│   Checkout               3 │'));
    assert.ok(!t.text().includes('Exit'), 'no Exit item');
    assert.ok(t.text().includes('Your cart is empty.'));
    assert.equal(statusRow(t), ' ↑↓ move  ⏎ select  1-3 jump  q quit');

    const raw = t.lastFrame();
    assert.equal(styleAt(raw, 'Menu').fg, 'cyan', 'menu panel has focus');
    assert.equal(styleAt(raw, 'Cart').fg, undefined, 'detail panel title default color');
    assert.equal(styleAt(raw, '╭').fg, 'cyan');
    assert.equal(styleAt(raw, '╭', 1).fg, undefined, 'only one focused panel');
    assert.equal(styleAt(raw, '╭', 1).dim, true, 'the other border is dim');
    assert.deepEqual(styleAt(raw, 'Browse products'), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false });
    t.unmount();
  });

  it('browse → add → cart → checkout with one invalid email → order placed', async () => {
    const { t, session } = open();
    await tick(20);

    // Home → Products
    await t.press('enter');
    let lines = assertScreen(t, 80, 24, 'Products');
    assert.ok(lines[2].startsWith('│ ID         Name                     Description'));
    assert.ok(lines[2].endsWith('Price │'));
    assert.ok(lines[3].startsWith('│ prod_001   Developer Blend          Dark roast for late nights'));
    assert.ok(lines[3].endsWith('$24.99 │'));
    assert.equal(statusRow(t), ' ↑↓ move  a add to cart  c cart  b back');
    assert.deepEqual(styleAt(t.lastFrame(), 'prod_001'), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false });

    // Add two products; the result is a status bar message, not a box.
    await t.press('a');
    assert.ok(statusRow(t).endsWith('✓ Added Developer Blend to cart'), statusRow(t));
    assert.equal(styleAt(t.lastFrame(), 'Added').fg, 'green');
    assert.ok(t.lines()[0].endsWith('cart: 1 · $24.99'));
    await t.press('down', 'a');
    assert.ok(statusRow(t).endsWith('✓ Added Terminal Espresso to cart'));
    assert.equal(session.cart.length, 2);
    assert.ok(!t.text().includes('┌') && t.lines().filter((l) => l.includes('╭')).length === 1, 'no floating box');

    // Cart
    await t.press('c');
    lines = assertScreen(t, 80, 24, 'Cart');
    assert.ok(lines[2].startsWith('│ Product'));
    assert.ok(lines[2].endsWith('Qty     Price   Subtotal │'));
    assert.ok(lines[3].startsWith('│ Developer Blend'));
    assert.ok(lines[3].endsWith('1    $24.99     $24.99 │'));
    assert.ok(lines[4].startsWith('│ Terminal Espresso'));
    assert.equal(lines[5], `│${' '.repeat(78)}│`);
    assert.ok(lines[6].startsWith('│ Total'));
    assert.ok(lines[6].endsWith('$44.98 │'));
    assert.equal(styleAt(t.lastFrame(), 'Total').bold, true);
    assert.equal(statusRow(t), ' ↑↓ move  c checkout  x clear cart  b back');

    // Checkout
    let raw0;
    await t.press('c');
    lines = assertScreen(t, 80, 24, 'Checkout');
    assert.ok(lines[1].startsWith('╭─ Shipping ─'));
    assert.ok(lines[3].startsWith('│ Name       Your name'));
    assert.ok(lines[5].startsWith('│ Email      you@example.com'));
    assert.ok(lines[7].startsWith('│ Address    Street, city'));
    assert.ok(lines[11].startsWith('╭─ Order ─'));
    assert.ok(t.text().includes('Developer Blend         1 × $24.99'));
    assert.ok(t.text().includes('Total                   $44.98'));
    assert.ok(t.text().includes('[ Place order ]'));
    raw0 = t.lastFrame();
    assert.equal(styleAt(raw0, 'Developer Blend').dim, true, 'order lines: muted name');
    assert.deepEqual(styleAt(raw0, 'Total'), { fg: undefined, bg: undefined, bold: true, dim: false, underline: false });
    assert.equal(styleAt(raw0, 'Your name').dim, true, 'placeholder is muted');
    assert.equal(statusRow(t), ' ↑↓ field  ⏎ edit  b back');
    assert.equal(styleAt(t.lastFrame(), 'Name').fg, 'cyan', 'first field focused');

    // Name: ⏎ edit, type, ⏎ save
    await t.press('enter');
    assert.equal(statusRow(t), ' ⏎ save  esc cancel');
    await typeText(t, 'Marko M.');
    assert.ok(t.lines()[3].startsWith('│ Name       Marko M.█'));
    await t.press('enter');
    assert.ok(t.lines()[3].startsWith('│ Name       Marko M. '));

    // Email: an invalid address
    await t.press('down', 'enter');
    await typeText(t, 'marko@');
    await t.press('enter');

    // Address; q while typing is text, not quit
    await t.press('down', 'enter');
    await typeText(t, 'Main Street 1 q');
    await t.press('backspace', 'backspace', 'enter');
    assert.ok(t.lines()[7].startsWith('│ Address    Main Street 1 '), t.lines()[7]);

    // [ Place order ]
    await t.press('down');
    assert.equal(statusRow(t), ' ↑↓ field  ⏎ place order  b back');
    let raw = t.lastFrame();
    assert.deepEqual(styleAt(raw, '[ Place order ]'), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false });
    assert.equal(styleAt(raw, 'Order').fg, 'cyan', 'Order panel focused with its button');
    assert.equal(styleAt(raw, 'Shipping').fg, undefined);

    await t.press('enter');
    lines = assertScreen(t, 80, 24, 'Checkout');
    assert.ok(lines[5].startsWith('│ Email      marko@'));
    assert.equal(lines[6], `│            ✗ Enter a full address${' '.repeat(44)}│`);
    assert.ok(statusRow(t).endsWith('✗ Fix 1 field before ordering'), statusRow(t));
    raw = t.lastFrame();
    assert.deepEqual(styleAt(raw, 'Email'), { fg: 'red', bg: undefined, bold: true, dim: false, underline: false });
    assert.equal(styleAt(raw, '✗ Enter').fg, 'red');
    assert.equal(session.cart.length, 2, 'nothing ordered yet');

    // Focus moved to the invalid field: fix it.
    await t.press('enter');
    await typeText(t, 'example.com');
    await t.press('enter');
    assert.ok(t.lines()[5].startsWith('│ Email      marko@example.com'));
    assert.equal(t.lines()[6], `│${' '.repeat(78)}│`, 'error line gone');
    assert.equal(statusRow(t), ' ↑↓ field  ⏎ edit  b back');

    await t.press('down', 'down', 'enter');
    lines = assertScreen(t, 80, 24, 'Home');
    assert.ok(statusRow(t).endsWith('✓ Order placed: 2 items, $44.98'), statusRow(t));
    assert.equal(session.cart.length, 0);
    assert.equal(session.orders.length, 1);
    assert.deepEqual(session.orders[0].shipping, { name: 'Marko M.', email: 'marko@example.com', address: 'Main Street 1' });
    assert.equal(session.checkoutFormData, undefined);
    t.unmount();
  });

  it('esc cancels an edit and keeps the old value', async () => {
    const session = new SessionManager().createSession(null);
    session.cart.push(new ProductModel().getAll()[0]);
    session.checkoutFormData = { name: 'Ada', email: '', address: '' };
    const t = renderTerminal(h(ShopApp, { session, initialScreen: 'checkout' }));
    await tick(20);
    assert.ok(t.lines()[3].startsWith('│ Name       Ada'));
    await t.press('enter');
    await typeText(t, 'xyz');
    await t.press('escape');
    assert.ok(t.lines()[3].startsWith('│ Name       Ada '), t.lines()[3]);
    assert.equal(statusRow(t), ' ↑↓ field  ⏎ edit  b back');
    // b goes back to the cart, as before the port
    await t.press('b');
    assertScreen(t, 80, 24, 'Cart');
    t.unmount();
  });

  it('cart: x clears, c on an empty cart warns, empty state says what to do', async () => {
    const session = new SessionManager().createSession(null);
    session.cart.push(new ProductModel().getAll()[1]);
    const t = renderTerminal(h(ShopApp, { session, initialScreen: 'cart' }));
    await tick(20);
    await t.press('x');
    assert.equal(session.cart.length, 0);
    assert.ok(statusRow(t).endsWith('i Cart cleared'));
    assert.ok(t.text().includes('Your cart is empty.'));
    assert.ok(t.text().includes('Browse products from the menu: b back'));
    await t.press('c');
    assertScreen(t, 80, 24, 'Cart');
    assert.ok(statusRow(t).endsWith('! Cart is empty'));
    assert.equal(styleAt(t.lastFrame(), '! Cart').fg, 'yellow');
    assert.ok(!t.lastFrame().includes('\u001B[31m'), 'an empty cart is not an error: no red');
    await t.press('escape');
    assertScreen(t, 80, 24, 'Home');
    t.unmount();
  });

  it('checkout with an empty cart shows the empty state', async () => {
    const { t } = open();
    await tick(20);
    await t.press('3', 'enter');
    assertScreen(t, 80, 24, 'Checkout');
    assert.ok(t.text().includes('Your cart is empty.'));
    assert.ok(t.text().includes('Add items before checkout: b back'));
    assert.equal(statusRow(t), ' b back');
    await t.press('b');
    assertScreen(t, 80, 24, 'Home');
    t.unmount();
  });

  it('number keys jump in the menu', async () => {
    const { t } = open();
    await tick(20);
    await t.press('2');
    assert.ok(t.lines()[3].startsWith('│ › View cart'));
    await t.press('enter');
    assertScreen(t, 80, 24, 'Cart');
    t.unmount();
  });

  it('q quits from any screen', async () => {
    const { t } = open();
    await tick(20);
    await t.press('enter');
    let exited = false;
    t.waitUntilExit().then(() => { exited = true; });
    await t.press('q');
    await tick(20);
    assert.equal(exited, true);
  });
});

describe('Shop screens (100x30)', () => {
  it('every screen fills the terminal', async () => {
    const session = new SessionManager().createSession(null);
    const t = renderTerminal(h(ShopApp, { session }), { columns: 100, rows: 30 });
    await tick(20);
    assertScreen(t, 100, 30, 'Home');
    await t.press('enter');
    let lines = assertScreen(t, 100, 30, 'Products');
    assert.ok(lines[3].endsWith('$24.99 │'), 'price column stays at the right edge');
    await t.press('a', 'c');
    assertScreen(t, 100, 30, 'Cart');
    await t.press('c');
    lines = assertScreen(t, 100, 30, 'Checkout');
    assert.ok(lines[11].startsWith('╭─ Order ─'), 'shipping panel keeps its height');
    t.unmount();
  });
});

describe('Checkout validation', () => {
  it('flags empty fields and a partial email', () => {
    assert.equal(validateField('name', ' '), 'Enter your name');
    assert.equal(validateField('email', ''), 'Enter your email');
    assert.equal(validateField('email', 'marko@'), 'Enter a full address');
    assert.equal(validateField('email', 'marko@example'), 'Enter a full address');
    assert.equal(validateField('email', 'marko@example.com'), null);
    assert.equal(validateField('address', ''), 'Enter a shipping address');
    assert.deepEqual(validateForm({ name: 'A', email: 'a@b.co', address: 'X' }), {});
    assert.deepEqual(Object.keys(validateForm({})), ['name', 'email', 'address']);
  });
});
