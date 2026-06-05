require('dotenv').config();
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');

(async () => {
  try {
    const products = await Product.find();
    if (!products || products.length === 0) return console.log('NO_PRODUCTS');
    console.log('PRODUCTS_COUNT:', products.length);
    for (const p of products) {
      const obj = (typeof p.toObject === 'function') ? p.toObject() : (p._instance && p._instance.get ? p._instance.get({ plain: true }) : p);
      const cat = obj.productCategory ? await Category._Model.findByPk(obj.productCategory) : null;
      const catPlain = cat && cat.get ? cat.get({ plain: true }) : null;
      console.log({ id: obj.id || obj._id, name: obj.productName, productCategoryStored: obj.productCategory, categoryFound: catPlain && catPlain.categoryName ? catPlain.categoryName : null });
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(2);
  }
})();
