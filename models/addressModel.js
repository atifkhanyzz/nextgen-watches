const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const createWrapper = require('./_sequelizeWrapper');

const AddressModel = sequelize.define('Address', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  address: { type: DataTypes.JSON, allowNull: false, defaultValue: [] }
});

module.exports = createWrapper(AddressModel);