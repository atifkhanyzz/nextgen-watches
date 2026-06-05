const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const createWrapper = require('./_sequelizeWrapper');

// We'll store items as JSON in SQLite for simplicity
const CartModel = sequelize.define('Cart', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  items: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  subTotal: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 }
});

module.exports = createWrapper(CartModel);
