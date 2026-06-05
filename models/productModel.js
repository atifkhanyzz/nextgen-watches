const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const createWrapper = require('./_sequelizeWrapper');

const ProductModel = sequelize.define('Product', {
  productName: { type: DataTypes.STRING, allowNull: false },
  productDescription: { type: DataTypes.TEXT, allowNull: false },
  productBrand: { type: DataTypes.STRING, allowNull: false },
  productCategory: { type: DataTypes.INTEGER, allowNull: false },
  productStock: { type: DataTypes.INTEGER, allowNull: false },
  productPrice: { type: DataTypes.FLOAT, allowNull: false },
  productImage: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  isListed: { type: DataTypes.BOOLEAN, defaultValue: true },
  productOfferPercentage: { type: DataTypes.FLOAT, defaultValue: 0 },
  discountedPrice: { type: DataTypes.FLOAT, defaultValue: 0 },
  highestOfferPercentage: { type: DataTypes.FLOAT, defaultValue: 0 }
});

module.exports = createWrapper(ProductModel);