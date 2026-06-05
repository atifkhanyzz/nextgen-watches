require('dotenv').config();
const Admin = require('../models/adminModel');

(async () => {
  try {
    const admins = await Admin.find();
    if (!admins || admins.length === 0) {
      console.log('NO_ADMINS');
      process.exit(0);
    }
    console.log('ADMINS_COUNT:', admins.length);
    admins.forEach((a, i) => {
      const obj = (typeof a.toObject === 'function') ? a.toObject() : (a._instance && a._instance.get ? a._instance.get({ plain: true }) : a);
      console.log(i + 1, obj);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(2);
  }
})();
