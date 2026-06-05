const User = require('../models/userModel');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const Category = require('../models/categoryModel');
const Admin = require('../models/adminModel');
const Address = require('../models/addressModel');
const Order = require('../models/orderModel');

// mongoose removed after migration to Sequelize

const bcrypt = require("bcryptjs");
const { name } = require('ejs');
const path = require("path")


module.exports = {

    loadOrderDetails: async (req, res, next) => {
        try {
            const userId = req.session.userId;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Unauthorized',
                });
            }

            const userRow = await User._Model.findByPk(userId);
            const userData = userRow && userRow.get({ plain: true });
            const orderId = req.params.orderId;
            const orderRow = await Order._Model.findByPk(orderId);
            if (!orderRow) return res.status(400).json({ success: false, message: 'Order not found' });
            const order = orderRow.get({ plain: true });

            // enrich product details
            const productIds = order.products.map(p => p.productId);
            const products = await Product._Model.findAll({ where: { id: productIds } });
            const prodMap = {};
            products.forEach(p => prodMap[p.id] = p.get({ plain: true }));
            order.products = order.products.map(p => ({ ...p, product: prodMap[p.productId] || null }));

            res.render('orderDetails', { user: userData, order });
        } catch (error) {
            next(error);
        }
    },
    cancelOrderAjax: async (req, res, next) => {
        try {
            const productId = req.params.productId;
            const productPrice = req.body.productPrice;
            const orders = await Order._Model.findAll();
            const all = orders.map(r => r.get({ plain: true }));
            const order = all.find(o => o.products && o.products.some(p => String(p.id) === String(productId)));
            if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

            const productEntry = order.products.find(p => String(p.id) === String(productId));
            if (!productEntry) return res.status(404).json({ success: false, message: 'Product not found in order' });

            if (!['Placed', 'Shipped'].includes(productEntry.orderStatus)) {
                return res.status(400).json({ success: false, message: `Order cannot be canceled at this stage due to product status "${productEntry.orderStatus}"` });
            }

            order.totalAmount = (order.totalAmount || 0) - parseFloat(productPrice || 0);

            // update product stock
            const product = await Product._Model.findByPk(productEntry.productId);
            if (product) {
                await product.increment('productStock', { by: productEntry.quantity });
            }

            // mark product as cancelled
            order.products = order.products.map(p => p.id === productId ? { ...p, orderStatus: 'Cancelled' } : p);

            // persist
            const orderRow = orders.find(r => r.id === order.id);
            await orderRow.update({ products: order.products, totalAmount: order.totalAmount });

            res.json({ success: true, message: 'Order canceled successfully' });
        } catch (error) {
            next(error);
        }
    },
    loadAdminOrder: async (req, res, next) => {
        try {

            const page = req.query.page || 1;
            const pageSize = 4;

            const skip = (page - 1) * pageSize;

            const { count, rows } = await Order._Model.findAndCountAll({ order: [['orderDate', 'DESC']], offset: skip, limit: pageSize });
            const orders = rows.map(r => r.get({ plain: true }));
            const totalOrders = count;
            const totalPages = Math.ceil(totalOrders / pageSize);

            // enrich user names
            const userIds = [...new Set(orders.map(o => o.user).filter(Boolean))];
            const users = await User._Model.findAll({ where: { id: userIds } });
            const userMap = {};
            users.forEach(u => userMap[u.id] = u.get({ plain: true }));
            orders.forEach(o => { o.user = userMap[o.user] || null; });

            res.render('orders', { orders, currentPage: page, totalPages });
        } catch (error) {
            next(error);
        }
    },
    loadManageOrder: async (req, res, next) => {
        try {
            let orderId = req.params.orderId;
            const orderRow = await Order._Model.findByPk(orderId);
            if (!orderRow) return res.render('manageOrder', { order: [] });
            const order = orderRow.get({ plain: true });
            const productIds = order.products.map(p => p.productId);
            const products = await Product._Model.findAll({ where: { id: productIds } });
            const prodMap = {};
            products.forEach(p => prodMap[p.id] = p.get({ plain: true }));
            order.products = order.products.map(p => ({ ...p, product: prodMap[p.productId] || null }));
            res.render('manageOrder', { order });
        } catch (error) {
            next(error);
        }
    },
    updateOrderStatus: async (req, res, next) => {
        try {
            const productId = req.params.productId;
            const newStatus = req.body.status;
            const orders = await Order._Model.findAll();
            const all = orders.map(r => r.get({ plain: true }));
            const order = all.find(o => o.products && o.products.some(p => String(p.id) === String(productId)));
            if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

            if (newStatus === 'Cancelled') {
                const productEntry = order.products.find(p => String(p.id) === String(productId));
                if (productEntry) {
                    const product = await Product._Model.findByPk(productEntry.productId);
                    if (product) await product.increment('productStock', { by: productEntry.quantity });
                }
            }

            const product = order.products.find(product => String(product.id) === String(productId));
            if (product) {
                product.orderStatus = newStatus;
                // persist changes
                const orderRow = orders.find(r => r.id === order.id);
                await orderRow.update({ products: order.products });
            } else {
                return res.status(404).json({ success: false, message: 'Product not found in order' });
            }

            res.redirect('/admin/orders');
        } catch (error) {
            next(error);
        }
    },
}