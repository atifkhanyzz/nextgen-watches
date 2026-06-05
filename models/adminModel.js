const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const createWrapper = require('./_sequelizeWrapper');

const AdminModel = sequelize.define('Admin', {
  email: { type: DataTypes.STRING, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  isAdmin: { type: DataTypes.INTEGER, allowNull: false }
});

module.exports = createWrapper(AdminModel);