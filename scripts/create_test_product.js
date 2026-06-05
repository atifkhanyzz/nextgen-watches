require('dotenv').config();
const Product = require('../models/productModel');

(async () => {
  try {
    const prod = await Product.create({
      productName: 'Test Watch',
      productDescription: 'A test watch',
      productBrand: 'TestBrand',
      productCategory: 1,
      productStock: 10,
      productPrice: 99.99,
      productImage: [],
      isListed: true
    });
    console.log('CREATED', prod._instance && prod._instance.get({ plain: true }));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(2);
  }
})();
