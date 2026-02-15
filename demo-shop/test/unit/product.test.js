import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { ProductModel } from '../../src/models/product.js';

describe('ProductModel', () => {
  it('should return all products', () => {
    const model = new ProductModel();
    const products = model.getAll();
    
    assert.ok(Array.isArray(products), 'Should return an array');
    assert.ok(products.length > 0, 'Should have products');
  });

  it('should return a product by id', () => {
    const model = new ProductModel();
    const product = model.getById('prod_001');
    
    assert.ok(product, 'Should find product');
    assert.strictEqual(product.id, 'prod_001');
    assert.ok(product.name, 'Product should have name');
    assert.ok(typeof product.price === 'number', 'Price should be a number');
  });

  it('should return undefined for non-existent id', () => {
    const model = new ProductModel();
    const product = model.getById('invalid_id');
    
    assert.strictEqual(product, undefined);
  });

  it('should have required product fields', () => {
    const model = new ProductModel();
    const products = model.getAll();
    const product = products[0];
    
    assert.ok(product.id, 'Product should have id');
    assert.ok(product.name, 'Product should have name');
    assert.ok(product.description, 'Product should have description');
    assert.ok(typeof product.price === 'number', 'Product should have numeric price');
    assert.ok(typeof product.stock === 'number', 'Product should have numeric stock');
  });
});
