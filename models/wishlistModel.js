const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const createWrapper = require('./_sequelizeWrapper');

const WishlistModel = sequelize.define('Wishlist', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.JSON, allowNull: false, defaultValue: [] }
});

module.exports = createWrapper(WishlistModel);