const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const uuid = require('uuid');
const createWrapper = require('./_sequelizeWrapper');

const UserModel = sequelize.define('User', {
  firstName: { type: DataTypes.STRING, allowNull: false },
  lastName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  mobileno: { type: DataTypes.STRING, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  isBlocked: { type: DataTypes.BOOLEAN, defaultValue: false },
  isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
  token: { type: DataTypes.STRING, defaultValue: '' },
  referalCode: { type: DataTypes.STRING }
}, {
  hooks: {
    beforeCreate: (user) => {
      user.referalCode = uuid.v4();
    }
  }
});

module.exports = createWrapper(UserModel);
