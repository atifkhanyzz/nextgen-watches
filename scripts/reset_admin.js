require('dotenv').config();
const bcrypt = require('bcryptjs');
const Admin = require('../models/adminModel');

// Usage: set desired email/password in the variables below then run `node scripts/reset_admin.js`
const NEW_EMAIL = 'atifkhanyzz@gmail.com';
const NEW_PASSWORD = 'atif1234';

(async () => {
  try {
    const admins = await Admin.find();
    if (!admins || admins.length === 0) {
      console.log('NO_ADMINS');
      process.exit(1);
    }

    const id = (typeof admins[0].toObject === 'function') ? admins[0].toObject().id : (admins[0]._instance && admins[0]._instance.id);
    if (!id) {
      console.error('Could not determine admin id');
      process.exit(2);
    }

    const hashed = await bcrypt.hash(NEW_PASSWORD, 10);
    await Admin.findByIdAndUpdate(id, { email: NEW_EMAIL, password: hashed, isAdmin: 1 });

    console.log('ADMIN_UPDATED', { id, email: NEW_EMAIL });
    process.exit(0);
  } catch (err) {
    console.error('ERROR', err && err.message ? err.message : err);
    process.exit(3);
  }
})();
