const Product = require('../models/productModel');

(async () => {
  try {
    const rows = await Product._Model.findAll();
    let updated = 0;
    for (const r of rows) {
      const p = r.get({ plain: true });
      const val = p.productImage;
      if (typeof val === 'string') {
        let parsed = [];
        try {
          parsed = JSON.parse(val);
          if (!Array.isArray(parsed)) parsed = [parsed];
        } catch (e) {
          // fallback: if it's '[]' or similar, keep as []
          if (val.trim() === '[]') parsed = [];
          else parsed = [val];
        }
        await Product._Model.update({ productImage: parsed }, { where: { id: p.id } });
        updated++;
        console.log('UPDATED', p.id, '->', parsed);
      }
    }
    console.log('DONE. updated count:', updated);
    process.exit(0);
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
})();
