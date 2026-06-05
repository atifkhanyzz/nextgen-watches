const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const createWrapper = require('./_sequelizeWrapper');

const CategoryModel = sequelize.define('Category', {
  categoryName: { type: DataTypes.STRING, allowNull: false },
  categoryDescription: { type: DataTypes.STRING, allowNull: false },
  isListed: { type: DataTypes.BOOLEAN, defaultValue: true },
  categoryOfferPercentage: { type: DataTypes.INTEGER, defaultValue: 0 }
});

module.exports = createWrapper(CategoryModel);