const { v4: uuidv4 } = require('uuid');
const User = require('../models/userModel');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const Address = require('../models/addressModel');
const Order = require('../models/orderModel');
const sequelize = require('../db');

module.exports = {
    loadCheckout: async (req, res, next) => {
        try {
            const userId = req.session.userId;
            const userRow = await User._Model.findByPk(userId);
            const userData = userRow && userRow.get({ plain: true });
            const addrRow = await Address._Model.findOne({ where: { userId } });
            const userAddress = addrRow && addrRow.get({ plain: true });
            const cartRow = await Cart._Model.findOne({ where: { userId } });
            const cartData = cartRow && cartRow.get({ plain: true });

            if (!cartData || !cartData.items || cartData.items.length === 0) return res.redirect('/cart');

            const ids = cartData.items.map(i => i.productId);
            const products = await Product._Model.findAll({ where: { id: ids } });
            const prodMap = {};
            products.forEach(p => prodMap[p.id] = p.get({ plain: true }));

            const insufficient = cartData.items.filter(item => {
                const p = prodMap[item.productId];
                return !p || item.quantity > p.productStock;
            });
            if (insufficient.length > 0) return res.redirect('/cart?error=insufficient-stock');

            const enriched = cartData.items.map(item => ({ ...item, product: prodMap[item.productId] || null }));
            res.render('checkout', { user: userData, address: userAddress, cart: { items: enriched, subTotal: cartData.subTotal } });
        } catch (error) {
            next(error);
        }
    },

    checkoutLoadAddress: async (req, res, next) => {
        try {
            const userId = req.session.userId;
            res.render('checkoutAddress', { user: userId });
        } catch (error) {
            next(error);
        }
    },

    checkoutAddAddress: async (req, res, next) => {
        try {
            const userId = req.session.userId;
            const addrRow = await Address._Model.findOne({ where: { userId } });
            const newAddress = {
                id: uuidv4(),
                fullName: req.body.fullName,
                mobile: req.body.mobile,
                state: req.body.state,
                district: req.body.district,
                city: req.body.city,
                pincode: req.body.pincode,
            };

            if (!addrRow) {
                await Address._Model.create({ userId, address: [newAddress] });
            } else {
                const addr = addrRow.get({ plain: true });
                addr.address.push(newAddress);
                await addrRow.update({ address: addr.address });
            }
            res.redirect('/checkout');
        } catch (error) {
            next(error);
        }
    },

    placeOrder: async (req, res, next) => {
        try {
            const addressId = req.body.addressId || req.body.addressOption || req.body.address;
            const userId = req.session.userId;

            console.log('placeOrder: userId=', userId, 'addressId=', addressId);

            if (!addressId) {
                return res.status(400).json({ error: 'Please select a shipping address.' });
            }

            const cartRow = await Cart._Model.findOne({ where: { userId } });
            const cartItems = cartRow && cartRow.get({ plain: true });
            if (!cartItems || !cartItems.items || !Array.isArray(cartItems.items) || cartItems.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cart is empty. Unable to place an order.',
                });
            }

            // ensure subtotal is a valid number
            const numericTotal = Number(cartItems.subTotal || 0) || 0;
            console.log('placeOrder: raw cart.subTotal=', cartItems.subTotal, 'numericTotal=', numericTotal);

            const addrRow = await Address._Model.findOne({ where: { userId } });
            const userAddrs = addrRow && addrRow.get({ plain: true });

            if (!userAddrs || !userAddrs.address || userAddrs.address.length === 0) return res.status(400).json({ error: 'Address not selected' });

            const shipAddress = userAddrs.address.find(a => String(a.id) === String(addressId));
            if (!shipAddress) return res.status(400).json({ error: 'Address not found' });

            const today = new Date();
            const expectedDelivery = new Date(today);
            expectedDelivery.setDate(today.getDate() + 7);

            // validate and update stock in a transaction
            const t = await sequelize.transaction();
            try {
                const ids = cartItems.items.map(i => i.productId);
                const products = await Product._Model.findAll({ where: { id: ids }, transaction: t, lock: t.LOCK.UPDATE });
                const prodMap = {};
                products.forEach(p => prodMap[p.id] = p);

                for (const item of cartItems.items) {
                    const p = prodMap[item.productId];
                    const qty = parseInt(item.quantity, 10);
                    if (!p || p.get('productStock') < qty) {
                        await t.rollback();
                        return res.status(400).json({ success: false, message: 'Insufficient stock for some products' });
                    }
                    // decrement
                    await p.decrement('productStock', { by: qty, transaction: t });
                }

                const orderProducts = cartItems.items.map(item => {
                    const p = prodMap[item.productId];
                    const plain = p.get({ plain: true });
                    return {
                        id: uuidv4(),
                        productId: item.productId,
                        quantity: item.quantity,
                        price: plain.discountedPrice,
                        orderStatus: 'Placed',
                        returnOrder: { reason: 'none' }
                    };
                });

                const placedOrder = await Order._Model.create({
                    user: userId,
                    products: orderProducts,
                    deliveryAddress: shipAddress,
                    totalAmount: numericTotal,
                    orderDate: new Date(),
                    expectedDelivery,
                    status: true
                }, { transaction: t });

                await Cart._Model.destroy({ where: { userId }, transaction: t });
                await t.commit();
                res.status(200).json({ placeOrder: placedOrder.get({ plain: true }), message: 'Order placed successfully' });
            } catch (err) {
                await t.rollback();
                throw err;
            }
        } catch (error) {
            next(error);
        }
    },

    loadThankyou: async (req, res, next) => {
        try {
            const userId = req.session.userId;
            const orderRow = await Order._Model.findOne({ where: { user: userId }, order: [['orderDate', 'DESC']] });
            const order = orderRow && orderRow.get({ plain: true });
            res.render('thankyou', { user: userId, order });
        } catch (error) {
            next(error);
        }
    },
};
