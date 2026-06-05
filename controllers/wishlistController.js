const User = require('../models/userModel');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const Category = require('../models/categoryModel');
const Admin = require('../models/adminModel');
const Address = require('../models/addressModel');
const Order = require('../models/orderModel');
const Wishlist = require('../models/wishlistModel');


// mongoose ObjectId removed after migration to Sequelize

const bcrypt = require("bcryptjs");
const { name } = require('ejs');
const path = require("path")

module.exports = {
    loadWishlist: async (req, res, next) => {
        try {
            const userId = req.session.userId;
            if (!userId) return res.render('wishlist', { wishlistProducts: [] });

            const wishlistRow = await Wishlist._Model.findOne({ where: { userId } });
            if (!wishlistRow) return res.render('wishlist', { wishlistProducts: [] });
            const wishlist = wishlistRow.get({ plain: true });
            const ids = wishlist.productId || [];
            if (!ids.length) return res.render('wishlist', { wishlistProducts: [] });
            const products = await Product._Model.findAll({ where: { id: ids } });
            const wishlistProducts = products.map(p => p.get({ plain: true }));
            res.render('wishlist', { wishlistProducts });
        } catch (error) {
            next(error);
        }
    },
    addToWishlist: async (req, res, next) => {
        try {
            if (req.session.userId) {
                const productId = req.body.id;
                const userId = req.session.userId;
                const userRow = await User._Model.findByPk(userId);
                if (!userRow) return res.status(404).json({ error: 'User not found' });
                const productRow = await Product._Model.findByPk(productId);
                if (!productRow) return res.status(404).json({ error: 'Product not found' });

                let wishRow = await Wishlist._Model.findOne({ where: { userId } });
                if (!wishRow) wishRow = await Wishlist._Model.create({ userId, productId: [] });
                const wish = wishRow.get({ plain: true });
                if ((wish.productId || []).includes(productId)) return res.json({ alreadyExist: true });
                wish.productId.push(productId);
                await wishRow.update({ productId: wish.productId });
                res.json({ success: true });
            } else {
                res.json({ loginRequired: true });
            }
        } catch (error) {
            next(error);
        }
    },
    removeProduct: async (req, res, next) => {
        try {
            const proId = req.body.product;
            const user = req.session.userId;
            if (!user) return res.json({ error: 'Not logged in' });

            const wishRow = await Wishlist._Model.findOne({ where: { userId: user } });
            if (!wishRow) return res.json({ error: 'Wishlist not found' });
            const wish = wishRow.get({ plain: true });
            const newList = (wish.productId || []).filter(id => String(id) !== String(proId));
            await wishRow.update({ productId: newList });
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    },

    wishlistCount: async (req, res, next) => {
        try {
            const userId = req.session.userId;
            if (!userId) return res.json({ totalItems: 0 });

            // Fetch the wishlist data from the database based on the user ID
            const wishRow = await Wishlist._Model.findOne({ where: { userId } });
            if (wishRow) {
                const wish = wishRow.get({ plain: true });
                const totalItems = (wish.productId || []).length;
                res.json({ totalItems });
            } else {
                res.json({ totalItems: 0 });
            }
        } catch (error) {
            next(error);
        }
    }

}   