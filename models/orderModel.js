const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const createWrapper = require('./_sequelizeWrapper');

const OrderModel = sequelize.define('Order', {
  user: { type: DataTypes.INTEGER, allowNull: false },
  products: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  deliveryAddress: { type: DataTypes.JSON, allowNull: false },
  totalAmount: { type: DataTypes.FLOAT, allowNull: false },
  orderDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  expectedDelivery: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.BOOLEAN, defaultValue: false }
});

module.exports = createWrapper(OrderModel);