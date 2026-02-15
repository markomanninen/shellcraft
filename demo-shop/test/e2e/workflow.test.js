import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { ProductModel } from '../../src/models/product.js';
import { SessionManager } from '../../src/server/session.js';

describe('E-commerce Workflow', () => {
  it('should complete full shopping workflow', () => {
    // 1. Create session
    const sessionManager = new SessionManager();
    const session = sessionManager.createSession(null);
    assert.ok(session, 'Session should be created');

    // 2. Browse products
    const productModel = new ProductModel();
    const products = productModel.getAll();
    assert.ok(products.length > 0, 'Should have products');

    // 3. Add products to cart
    const product1 = products[0];
    const product2 = products[1];
    session.cart.push(product1);
    session.cart.push(product2);
    assert.strictEqual(session.cart.length, 2, 'Cart should have 2 items');

    // 4. Calculate total
    const total = session.cart.reduce((sum, item) => sum + item.price, 0);
    assert.ok(total > 0, 'Total should be positive');
    assert.strictEqual(
      total,
      product1.price + product2.price,
      'Total should match sum of prices'
    );

    // 5. Clear cart (simulate checkout)
    session.cart = [];
    assert.strictEqual(session.cart.length, 0, 'Cart should be empty after checkout');

    // 6. Clean up session
    sessionManager.destroySession(session.id);
    const retrieved = sessionManager.getSession(session.id);
    assert.strictEqual(retrieved, undefined, 'Session should be destroyed');
  });

  it('should handle multiple concurrent sessions', () => {
    const sessionManager = new SessionManager();
    const productModel = new ProductModel();
    
    // Create multiple sessions
    const sessions = [];
    for (let i = 0; i < 5; i++) {
      sessions.push(sessionManager.createSession(null));
    }

    assert.strictEqual(sessions.length, 5, 'Should create 5 sessions');

    // Each session adds different products
    const products = productModel.getAll();
    sessions.forEach((session, index) => {
      if (products[index]) {
        session.cart.push(products[index]);
      }
    });

    // Verify isolation
    sessions.forEach((session, index) => {
      assert.strictEqual(
        session.cart.length,
        products[index] ? 1 : 0,
        `Session ${index} should have correct cart`
      );
    });

    // Clean up
    sessions.forEach(session => {
      sessionManager.destroySession(session.id);
    });
  });
});
