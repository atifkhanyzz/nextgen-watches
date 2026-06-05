require('dotenv').config();
const bcrypt = require('bcryptjs');
const Admin = require('../models/adminModel');

(async () => {
  const admins = await Admin.find();
  if (!admins || admins.length === 0) return console.log('NO_ADMINS');
  const admin = (typeof admins[0].toObject === 'function') ? admins[0].toObject() : admins[0];
  const hash = admin.password;

  const candidates = ['admin', 'admin123', 'password', 'admin@123', 'nextgen', 'nextgen123', '123456', 'admin@2026'];

  for (const p of candidates) {
    const ok = await bcrypt.compare(p, hash);
    console.log(p, ok);
    if (ok) {
      console.log('FOUND', p);
      process.exit(0);
    }
  }

  console.log('NOT_FOUND');
  process.exit(0);
})();
