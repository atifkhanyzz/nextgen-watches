const User = require('../models/userModel');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const Category = require('../models/categoryModel');
const Admin = require('../models/adminModel');

const { Op } = require('sequelize');
const path = require("path")

function normalizeProductImages(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
        try {
            let parsed = JSON.parse(value);
            if (typeof parsed === 'string') {
                try { parsed = JSON.parse(parsed); } catch (e) { /* keep parsed */ }
            }
            if (Array.isArray(parsed)) return parsed.filter(Boolean);
            return parsed ? [parsed] : [];
        } catch (e) {
            return value.trim() ? [value] : [];
        }
    }
    return [];
}

function getDisplayImage(productImage) {
    const images = normalizeProductImages(productImage);
    const img = images.find(x => typeof x === 'string' && x.trim() !== '');
    if (!img) return '/car/userAssets/images/icons/logo-01.png';
    if (img.startsWith && (img.startsWith('http') || img.startsWith('/'))) return img;
    return '/car/productImages/' + img;
}


module.exports = {
    addToCart: async (req, res, next) => {
        try {
            if (req.session.userId) {
                // Accept either productId (JSON body) or id (legacy form)
                let productId = req.body.productId || req.body.id;
                if (!productId) return res.status(400).json({ success: false, message: 'productId is required' });
                // normalize/validate productId
                productId = Number(productId);
                if (!Number.isInteger(productId) || productId <= 0) return res.status(400).json({ success: false, message: 'Invalid productId' });
                const userId = req.session.userId;
                const userRow = await User._Model.findByPk(userId);
                if (!userRow) return res.status(404).json({ success: false, message: 'User not found' });

                const productRow = await Product._Model.findByPk(productId);
                if (!productRow) return res.status(404).json({ success: false, message: 'Product not found' });
                const productData = productRow.get({ plain: true });
                if (productData.productStock == 0) return res.json({ outofstock: true });

                let cartRow = await Cart._Model.findOne({ where: { userId } });
                if (!cartRow) {
                    cartRow = await Cart._Model.create({ userId, items: [], subTotal: 0 });
                }

                // normalize items from DB
                let rawItems = cartRow.get('items');
                let items = [];
                if (rawItems == null) items = [];
                else if (typeof rawItems === 'string') {
                    try { items = JSON.parse(rawItems); } catch (e) { items = []; }
                } else if (Array.isArray(rawItems)) items = rawItems;
                else items = Array.isArray(rawItems.items) ? rawItems.items : [];

                console.log('addToCart: beforeSave rawItems=', rawItems, 'normalized=', items);

                const existingIndex = items.findIndex(p => Number(p.productId) === Number(productId));
                let newItems;
                if (existingIndex !== -1) {
                    const existingProduct = items[existingIndex];
                    if (productData.productStock <= existingProduct.quantity) return res.json({ outofstock: true });
                    // create new array with updated quantity
                    newItems = items.map((it, idx) => idx === existingIndex ? { ...it, quantity: it.quantity + 1 } : { ...it });
                } else {
                    newItems = [...items, { productId: productId, quantity: 1 }];
                }

                // recalc subtotal using newItems
                const productIds = newItems.map(i => i.productId);
                const products = await Product._Model.findAll({ where: { id: productIds } });
                const prodMap = {};
                products.forEach(p => { prodMap[p.id] = p.get({ plain: true }); });
                let total = 0;
                newItems.forEach(item => {
                    const p = prodMap[item.productId];
                    if (p) total += item.quantity * p.discountedPrice;
                });

                // Always assign a brand-new array and save via set/save to ensure Sequelize notices changes
                cartRow.set('items', newItems);
                cartRow.set('subTotal', total);
                cartRow.changed('items', true);
                await cartRow.save();

                // verify saved
                const saved = await Cart._Model.findOne({ where: { userId } });
                const savedPlain = saved ? saved.get({ plain: true }) : null;
                console.log('addToCart: userId=', userId, 'productId=', productId, 'cartSaved=', !!savedPlain);
                if (!savedPlain || !Array.isArray(savedPlain.items) || !savedPlain.items.find(i => String(i.productId) === String(productId))) {
                    console.error('addToCart: item not found after save', savedPlain);
                    return res.status(500).json({ success: false, message: 'Product was not saved to cart' });
                }

                return res.json({ success: true, message: 'Product added to cart' });
            } else {
                return res.status(401).json({ success: false, message: 'Login required', loginRequired: true });
            }
        } catch (error) {
            console.error('addToCart error:', error);
            return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
        }
    },
    loadCart: async (req, res, next) => {
        try {
            if (req.session.userId) {
                const userId = req.session.userId;
                const cartRow = await Cart._Model.findOne({ where: { userId } });
                if (cartRow) {
                    // normalize items
                    let rawItems = cartRow.get('items');
                    let items = [];
                    if (rawItems == null) items = [];
                    else if (typeof rawItems === 'string') {
                        try { items = JSON.parse(rawItems); } catch (e) { items = []; }
                    } else if (Array.isArray(rawItems)) items = rawItems;
                    else items = Array.isArray(rawItems.items) ? rawItems.items : [];
                    console.log('loadCart: userId=', userId, 'rawItems=', rawItems, 'normalized=', items);
                    if (items && items.length > 0) {
                        const ids = items.map(i => i.productId);
                        const products = await Product._Model.findAll({ where: { id: ids } });
                        const prodMap = {};
                        products.forEach(p => prodMap[p.id] = p.get({ plain: true }));

                        let total = 0;
                        // map product object into productId field to match templates
                        const enriched = items.map(item => {
                            const p = prodMap[item.productId] || null;
                            if (p) total += item.quantity * p.discountedPrice;
                            const productObj = p ? { ...p, _id: p.id } : null;
                            // normalize productImage and compute displayImage for template
                            if (productObj) {
                                productObj.productImage = normalizeProductImages(productObj.productImage);
                                productObj.displayImage = getDisplayImage(productObj.productImage);
                            }
                            return { ...item, productId: productObj, displayImage: productObj ? productObj.displayImage : '/car/userAssets/images/icons/logo-01.png' };
                        });

                        return res.render('cart', { user: req.session.userId, userId, cart: enriched, total });
                    }
                }
                res.render('cart', { user: req.session.userId, cart: [], total: 0 });
            } else {

                res.redirect('/login?errors=Please log in to view');

            }
        } catch (error) {
            next(error);
        }
    },
    cartQuantity: async (req, res, next) => {
        const user_id = req.body.user;
        const product_Id = req.body.product;
        const number = parseInt(req.body.count);
        const quantityChange = number;

        try {
            const cartRow = await Cart._Model.findOne({ where: { userId: user_id } });
            if (!cartRow) return res.status(404).json({ success: false, message: 'Cart not found' });

            // normalize items
            let rawItems = cartRow.get('items');
            let items = [];
            if (rawItems == null) items = [];
            else if (typeof rawItems === 'string') {
                try { items = JSON.parse(rawItems); } catch (e) { items = []; }
            } else if (Array.isArray(rawItems)) items = rawItems;
            else items = Array.isArray(rawItems.items) ? rawItems.items : [];

            const cartItem = items.find(item => Number(item.productId) === Number(product_Id));
            if (!cartItem) return res.status(404).json({ success: false, message: 'Product not found in the cart' });

            const productRow = await Product._Model.findByPk(product_Id);
            const productData = productRow && productRow.get({ plain: true });
            const productStock = productData ? productData.productStock : 0;

            const newQuantity = cartItem.quantity + quantityChange;
            if (newQuantity < 1) return res.status(400).json({ success: false, message: 'Quantity cannot be less than 1' });
            else if (newQuantity > productStock) return res.status(400).json({ success: false, message: 'Product stock exceeded' });
            else if (newQuantity > 10) return res.status(400).json({ success: false, message: 'Only 10 items can be purchased' });

            // construct new items array immutably
            const newItems = items.map(it => it.productId == product_Id ? { ...it, quantity: newQuantity } : { ...it });

            // recalc subtotal
            const productIds = newItems.map(i => i.productId);
            const products = await Product._Model.findAll({ where: { id: productIds } });
            const prodMap = {};
            products.forEach(p => { prodMap[p.id] = p.get({ plain: true }); });
            let total = 0;
            newItems.forEach(item => {
                const p = prodMap[item.productId];
                if (p) total += item.quantity * p.discountedPrice;
            });

            cartRow.set('items', newItems);
            cartRow.set('subTotal', total);
            cartRow.changed('items', true);
            await cartRow.save();

            return res.status(200).json({ changeSuccess: true, message: 'Quantity updated successfully', cart: { items: newItems, subTotal: total } });

        } catch (error) {
            next(error);
        }
    },
    removeProduct: async (req, res, next) => {
        try {
            const proId = req.body.product;
            const user = req.session.userId;
            const cartRow = await Cart._Model.findOne({ where: { userId: user } });
            if (!cartRow) return res.json({ error: 'Cart not found' });

            // normalize items
            let rawItems = cartRow.get('items');
            let items = [];
            if (rawItems == null) items = [];
            else if (typeof rawItems === 'string') {
                try { items = JSON.parse(rawItems); } catch (e) { items = []; }
            } else if (Array.isArray(rawItems)) items = rawItems;
            else items = Array.isArray(rawItems.items) ? rawItems.items : [];

            const newItems = items.filter(i => Number(i.productId) !== Number(proId));
            // recalc subtotal
            const productIds = newItems.map(i => i.productId);
            const products = await Product._Model.findAll({ where: { id: productIds } });
            const prodMap = {};
            products.forEach(p => { prodMap[p.id] = p.get({ plain: true }); });
            let total = 0;
            newItems.forEach(item => {
                const p = prodMap[item.productId];
                if (p) total += item.quantity * p.discountedPrice;
            });

            cartRow.set('items', newItems);
            cartRow.set('subTotal', total);
            cartRow.changed('items', true);
            await cartRow.save();
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    },
    cartCount: async (req, res, next) => {
        try {
            const userId = req.session.userId;
            if (!userId) return res.json({ totalItems: 0 });

            const cartRow = await Cart._Model.findOne({ where: { userId } });
            if (cartRow) {
                const cart = cartRow.get({ plain: true });
                const totalItems = (cart.items || []).reduce((acc, item) => acc + item.quantity, 0);
                res.json({ totalItems });
            } else {
                res.json({ totalItems: 0 });
            }
        } catch (error) {
            next(error);
        }
    }
}