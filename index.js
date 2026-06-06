const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const sequelize = require('./db');
const { DataTypes } = require('sequelize');
const User = require('./models/userModel');

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Railway / proxy support
app.set('trust proxy', 1);

// Body parsers must be before routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve product images with explicit MIME handling for uncommon extensions
const productImagesPath = path.join(__dirname, 'public', 'productImages');

app.use(
  '/car/productImages',
  (req, res, next) => {
    const ext = path.extname(req.path).toLowerCase();

    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.jfif': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    if (mimeMap[ext]) {
      res.type(mimeMap[ext]);
    }

    next();
  },
  express.static(productImagesPath)
);

// Serve other public assets under /car
app.use('/car', express.static(path.join(__dirname, 'public')));

// Routes
const userRoute = require('./routes/userRoute');
app.use('/', userRoute);

const adminRoute = require('./routes/adminRoute');
app.use('/admin', adminRoute);

// 404 page
app.use((req, res) => {
  res.status(404).render('users/404');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).send('Internal Server Error');
});

// Start server only after database connects
async function startServer() {
  try {
    await sequelize.authenticate();

    // Ensure soft-delete columns exist on User table (safe migration)
    try {
      const queryInterface = sequelize.getQueryInterface();
      const tableName = User._Model.getTableName();
      const tableDesc = await queryInterface.describeTable(tableName);

      if (!tableDesc.isDeleted) {
        console.log(`Adding missing column isDeleted to table ${tableName}`);
        await queryInterface.addColumn(tableName, 'isDeleted', { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false });
      }
      if (!tableDesc.deletedAt) {
        console.log(`Adding missing column deletedAt to table ${tableName}`);
        await queryInterface.addColumn(tableName, 'deletedAt', { type: DataTypes.DATE, allowNull: true });
      }
    } catch (mErr) {
      console.warn('Soft-delete migration check failed:', mErr && mErr.message);
    }

    await sequelize.sync();

    global.__DB_CONNECTED = true;
    console.log('SQLite (Sequelize) connected and synced');

    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || '0.0.0.0';

    app.listen(PORT, HOST, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    global.__DB_CONNECTED = false;
    console.error('SQLite initialization failed:');
    console.error(err);

    // In production/Railway, fail fast so the deployment logs show the real DB problem.
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }

    // Local fallback: still start server so you can debug pages/routes.
    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || '0.0.0.0';

    app.listen(PORT, HOST, () => {
      console.log(`Server running without DB on port ${PORT}`);
    });
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

startServer();