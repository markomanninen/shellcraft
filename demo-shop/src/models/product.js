export class ProductModel {
  constructor() {
    this.products = [
      {
        id: 'prod_001',
        name: 'Developer Blend',
        description: 'Dark roast for late nights',
        price: 24.99,
        stock: 100
      },
      {
        id: 'prod_002',
        name: 'Terminal Espresso',
        description: 'Quick and powerful',
        price: 19.99,
        stock: 50
      },
      {
        id: 'prod_003',
        name: 'Command Line Coffee',
        description: 'Medium roast, smooth finish',
        price: 21.99,
        stock: 75
      },
      {
        id: 'prod_004',
        name: 'Git Commit Grounds',
        description: 'Light roast with fruity notes',
        price: 22.99,
        stock: 60
      }
    ];
  }

  getAll() {
    return this.products;
  }

  getById(id) {
    return this.products.find(p => p.id === id);
  }
}
