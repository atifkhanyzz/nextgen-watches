require('dotenv').config();
const Category = require('../models/categoryModel');

(async () => {
  try {
    const cats = await Category.find();
    if (!cats || cats.length === 0) return console.log('NO_CATEGORIES');
    console.log('CATEGORIES_COUNT:', cats.length);
    cats.forEach((c, i) => {
      const obj = (typeof c.toObject === 'function') ? c.toObject() : (c._instance && c._instance.get ? c._instance.get({ plain: true }) : c);
      console.log(i+1, { id: obj.id || obj._id, categoryName: obj.categoryName, isListed: obj.isListed });
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(2);
  }
})();
