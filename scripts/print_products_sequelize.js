require('dotenv').config();
const sequelize = require('../db');
const Product = require('../models/productModel');

(async ()=>{
  try{
    await sequelize.authenticate();
    const rows = await Product._Model.findAll({ limit: 10 });
    if(!rows || rows.length===0){
      console.log('NO_PRODUCTS');
      return;
    }
    for(const r of rows){
      const p = r.get({ plain: true });
      p._id = p.id;
      console.log({ id: p._id, name: p.productName, productImage: p.productImage });
    }
  }catch(e){
    console.error(e);
  }finally{
    process.exit(0);
  }
})();
