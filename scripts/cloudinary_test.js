require('dotenv').config();
const cloudinary = require('../config/cloudinary');

(async () => {
  try {
    const res = await cloudinary.api.resources({ max_results: 1 });
    console.log('CLOUDINARY_OK');
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('CLOUDINARY_ERROR');
    console.error(err && err.message ? err.message : err);
    process.exit(2);
  }
})();
