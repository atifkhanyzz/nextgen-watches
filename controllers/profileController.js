const User = require('../models/userModel');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const Category = require('../models/categoryModel');
const Admin = require('../models/adminModel');
const Address = require('../models/addressModel');
const Order = require('../models/orderModel');


// mongoose ObjectId removed after migration to Sequelize

const bcrypt = require("bcryptjs");
const { name } = require('ejs');
const path = require("path")


module.exports = {
    loadProfile: async (req, res, next) => {
        try {
            const id = req.session.userId
            const userRow = await User._Model.findByPk(id);
            const userData = userRow && userRow.get({ plain: true });
            const addrRow = await Address._Model.findOne({ where: { userId: id } });
            const userAddress = addrRow && addrRow.get({ plain: true });
            const orderRows = await Order._Model.findAll({ where: { user: id }, order: [['orderDate', 'DESC']] });
            const orderData = orderRows.map(r => r.get({ plain: true }));
            // Check if userData is not null or undefined
            if (userData) {
                res.render('userProfile', { user: userData, address: userAddress, orders: orderData, error: null });
            } else {
                res.render('userProfile', { user: id, orders: [], error: 'User Data is null or undefined' });
            }
        } catch (error) {
            next(error);
        }
    },

    userLogout: async (req, res, next) => {
        try {
            if (req.session.userId) {
                delete req.session.userId;
            }
            res.redirect('/')
        } catch (error) {
            next(error);
        }
    },

    updateUser: async (req, res, next) => {
        try {

            const user_id = req.session.userId
            await User._Model.update({
                firstName: req.body.EPFname,
                lastName: req.body.EPLname,
                email: req.body.EPemail,
                mobile: req.body.EPmobile
            }, { where: { id: user_id } });
            res.redirect('/userProfile')

        } catch (error) {
            next(error);
        }
    },
    profileResetPassword: async (req, res, next) => {

        try {
            const userRow = await User._Model.findByPk(req.session.userId);
            const userDetails = userRow && userRow.get({ plain: true });
            const isPasswordMatch = await bcrypt.compare(req.body.oldPassword, userDetails.password);
            if (isPasswordMatch) {
                const newSecurePassword = await bcrypt.hash(req.body.newPassword, 10);
                await User._Model.update({ password: newSecurePassword }, { where: { id: userDetails.id } });
                return res.status(200).json({ success: true, message: 'Password changed successfully.' });
            } else {
                return res.status(400).json({ success: false, message: 'Incorrect old password.' });
            }

        } catch (error) {
            next(error);
        }
    },
    loadAddress: async (req, res, next) => {
        try {
            const userId = req.session.userId
            res.render('address', { user: userId })
        } catch (error) {
            next(error);
        }
    },
    addAddress: async (req, res, next) => {
        try {
            const userId = req.session.userId;
            const addrRow = await Address._Model.findOne({ where: { userId } });
            const newAddr = {
                id: require('uuid').v4(),
                fullName: req.body.fullName,
                mobile: req.body.mobile,
                state: req.body.state,
                district: req.body.district,
                city: req.body.city,
                pincode: req.body.pincode
            };
            if (!addrRow) {
                await Address._Model.create({ userId, address: [newAddr] });
            } else {
                const addr = addrRow.get({ plain: true });
                addr.address.push(newAddr);
                await addrRow.update({ address: addr.address });
            }
            res.redirect('/userProfile');
        } catch (error) {
            next(error);
        }
    },
    loadEditAddress: async (req, res, next) => {
        try {

            const id = req.query.id
            const userId = req.session.userId

            const addrRow = await Address._Model.findOne({ where: { userId } });
            if (!addrRow) return res.render('editAddress', { user: userId, addresses: null });
            const addr = addrRow.get({ plain: true });
            const found = (addr.address || []).find(a => String(a.id) === String(id));
            res.render('editAddress', { user: userId, addresses: found });


        } catch (error) {
            next(error);
        }
    },
    editAddress: async (req, res, next) => {
        try {
            const user_id = req.session.userId
            const addressId = req.body.id
            const addrRow = await Address._Model.findOne({ where: { userId: user_id } });
            if (!addrRow) return res.redirect('/userProfile');
            const addr = addrRow.get({ plain: true });
            const idx = addr.address.findIndex(a => String(a.id) === String(addressId));
            if (idx === -1) return res.redirect('/userProfile');
            addr.address[idx] = {
                ...addr.address[idx],
                fullName: req.body.fullName,
                pincode: req.body.pincode,
                city: req.body.city,
                mobile: req.body.mobile,
                state: req.body.state,
                district: req.body.district
            };
            await addrRow.update({ address: addr.address });
            res.redirect('/userProfile')

        } catch (error) {
            next(error);
        }
    },
    deleteAddress: async (req, res, next) => {
        try {
            const addrRow = await Address._Model.findOne({ where: { userId: req.session.userId } });
            if (!addrRow) return res.status(404).json({ remove: 0 });
            const addr = addrRow.get({ plain: true });
            const addressToDeleteIndex = addr.address.findIndex(a => String(a.id) === String(req.body.id));
            if (addressToDeleteIndex === -1) return res.status(404).json({ remove: 0 });
            addr.address.splice(addressToDeleteIndex, 1);
            await addrRow.update({ address: addr.address });
            return res.json({ remove: 1 });
        } catch (error) {
            next(error);
        }
    },
    invoiceDownload: async (req, res, next) => {
        try {
            const { orderId } = req.query;
            const orderRow = await Order._Model.findByPk(orderId);
            if (!orderRow) return res.status(404).send('Order not found');
            const orderData = orderRow.get({ plain: true });
            const productIds = orderData.products.map(p => p.productId);
            const products = await Product._Model.findAll({ where: { id: productIds } });
            const prodMap = {};
            products.forEach(p => prodMap[p.id] = p.get({ plain: true }));
            orderData.products = orderData.products.map(p => ({ ...p, product: prodMap[p.productId] || null }));

            const userId = req.session.userId;
            const userRow = await User._Model.findByPk(userId);
            const userData = userRow && userRow.get({ plain: true });

            const date = new Date();
            res.render('invoice', { order: orderData, user: userData, date });
        } catch (error) {
            next(error);
        }
    },

}