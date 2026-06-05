const Admin = require('../models/adminModel');
const User = require('../models/userModel');
const Category = require('../models/categoryModel');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const bcrypt = require('bcryptjs');
const fs = require("fs");
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const ExcelJS = require('exceljs');
const { Parser } = require('json2csv');
const { Op } = require('sequelize');
const sequelize = require('../db');

function plainWithUnderscoreId(row) {
    const p = row.get({ plain: true });
    p._id = p.id;
    return p;
}

module.exports = {
    loadLogin: async (req, res, next) => {
        try {
            res.render('login');
        } catch (error) {
            next(error);
        }
    },

    verifyLogin: async (req, res, next) => {
    try {
        const { email, password } = req.body;

        console.log("LOGIN BODY:", req.body);

        const adminData = await Admin.findOne({ email });

        console.log("ADMIN FOUND:", adminData);

        if (!adminData) {
            return res.render('login', { message: 'email or password is incorrect' });
        }

        let passwordMatch = false;

        if (adminData.password && adminData.password.startsWith('$2')) {
            passwordMatch = await bcrypt.compare(password, adminData.password);
        } else {
            passwordMatch = password === adminData.password;
        }

        console.log("PASSWORD MATCH:", passwordMatch);
        console.log("IS ADMIN:", adminData.isAdmin);

        if (passwordMatch && Number(adminData.isAdmin) === 1) {
            req.session.admin_id = adminData._id;
            return res.redirect('/admin/dashboard');
        }

        return res.render('login', { message: 'email or password is incorrect' });

    } catch (error) {
        next(error);
    }
},

    adminLogout: async (req, res, next) => {
        try {
            if (req.session.admin_id) {
                delete req.session.admin_id;
            }
            res.redirect('/admin');
        } catch (error) {
            next(error);
        }
    },

    loadDashboard: async (req, res, next) => {
        try {
            const totalUsers = await User._Model.count();
            const totalOrders = await Order._Model.count();

            const orders = await Order._Model.findAll();
            const totalRevenue = orders.reduce((s, o) => s + (o.get ? o.get({ plain: true }).totalAmount : o.totalAmount || 0), 0);
            const averageOrderValue = totalOrders !== 0 ? totalRevenue / totalOrders : 0;

            const allProductsRows = await Product._Model.findAll({ attributes: ['id', 'productName', 'productCategory'] });
            const allProducts = allProductsRows.map(r => { const p = r.get({ plain: true }); p._id = p.id; return p; });

            // revenue per product
            const revenueMap = {};
            orders.forEach(oRow => {
                const o = oRow.get({ plain: true });
                (o.products || []).forEach(p => {
                    revenueMap[p.productId] = (revenueMap[p.productId] || 0) + (p.price * p.quantity || 0);
                });
            });

            const productData = allProducts.map(product => ({ name: product.productName, revenue: revenueMap[product.id] || 0 }));
            const sortedProducts = productData.sort((a, b) => b.revenue - a.revenue);
            const top3Products = sortedProducts.slice(0, 3);
            const productLabels = top3Products.map(p => p.name);
            const productRevenues = top3Products.map(p => p.revenue);

            // revenue per category
            const categoryRevenue = {};
            allProducts.forEach(prod => {
                const rev = revenueMap[prod.id] || 0;
                if (prod.productCategory) categoryRevenue[prod.productCategory] = (categoryRevenue[prod.productCategory] || 0) + rev;
            });

            const allCategoriesRows = await Category._Model.findAll({ attributes: ['id', 'categoryName'] });
            const allCategories = allCategoriesRows.map(r => { const p = r.get({ plain: true }); p._id = p.id; return p; });
            const categoryData = allCategories.map(cat => ({ name: cat.categoryName, revenue: categoryRevenue[cat.id] || 0 }));
            const sortedCategories = categoryData.sort((a, b) => b.revenue - a.revenue);
            const top3Categories = sortedCategories.slice(0, 3);
            const categoryLabels = top3Categories.map(c => c.name);
            const categoryRevenues = top3Categories.map(c => c.revenue);

            res.render('dashboard', {
                totalUsers,
                totalOrders,
                totalRevenue,
                averageOrderValue,
                productLabels,
                productRevenues,
                categoryLabels,
                categoryRevenues,
                top3Categories,
                top3Products
            });
        } catch (error) {
            next(error);
        }
    },

    loadUsers: async (req, res, next) => {
        try {
            let search = '';
            if (req.query.search) {
                search = req.query.search;
            }

            const page = req.query.page || 1;
            const pageSize = 4;
            const skip = (page - 1) * pageSize;

            let users;

            if (search) {
                users = await User._Model.findAll({
                    where: {
                        [Op.or]: [
                            { firstName: { [Op.like]: `%${search}%` } },
                            { lastName: { [Op.like]: `%${search}%` } },
                            { email: { [Op.like]: `%${search}%` } },
                            { mobileno: { [Op.like]: `%${search}%` } }
                        ]
                    }
                });
            } else {
                const rows = await User._Model.findAll({ offset: skip, limit: pageSize });
                users = rows.map(r => r.get({ plain: true }));
            }

            const totalUsers = await User._Model.count();
            const totalPages = Math.ceil(totalUsers / pageSize);

            res.render('Users', { users, currentPage: page, totalPages });
        } catch (error) {
            next(error);
        }
    },

    blockUser: async (req, res, next) => {
        try {
            const id = req.query.id;
            const userRow = await User._Model.findByPk(id);
            if (userRow) {
                const user = userRow.get({ plain: true });
                await userRow.update({ isBlocked: !user.isBlocked });
            }
            res.redirect('/admin/Users');
        } catch (error) {
            next(error);
        }
    },

    loadAddCategory: (req, res, next) => {
        try {
            res.render('addCategory');
        } catch (error) {
            next(error);
        }
    },

    addCategory: async (req, res, next) => {
        try {
            const { categoryName } = req.body;
            const exists = await Category._Model.findOne({ where: { categoryName: { [Op.like]: `%${categoryName}%` } } });
            if (exists) return res.render('addCategory', { message: 'Category Already Created' });
            await Category._Model.create({ ...req.body, isListed: true });
            res.redirect('/admin/addCategory');
        } catch (error) {
            next(error);
        }
    },

    loadViewCategory: async (req, res, next) => {
        try {
            const page = req.query.page || 1;
            const pageSize = 4;
            const skip = (page - 1) * pageSize;

            let categories;
            let search = '';

            if (req.query.search) {
                search = req.query.search;
                const searchRegex = new RegExp('.*' + search + '.*', 'i');
                categories = await Category._Model.findAll({
                    where: {
                        [Op.or]: [
                            { categoryName: { [Op.like]: `%${search}%` } },
                            { categoryDescription: { [Op.like]: `%${search}%` } }
                        ]
                    }
                });
            } else {
                const rows = await Category._Model.findAll({ offset: skip, limit: pageSize });
                categories = rows.map(r => { const p = r.get({ plain: true }); p._id = p.id; return p; });
            }

            const totalCategories = await Category._Model.count();
            const totalPages = Math.ceil(totalCategories / pageSize);

            res.render('viewCategory', {
                category: categories,
                currentPage: page,
                totalPages
            });
        } catch (error) {
            next(error);
        }
    },

    unlistCategory: async (req, res, next) => {
        try {
            const id = req.query.id;
            const catRow = await Category._Model.findByPk(id);
            if (catRow) {
                const cat = catRow.get({ plain: true });
                await catRow.update({ isListed: !cat.isListed });
            }
            res.redirect('/admin/viewCategory');
        } catch (error) {
            next(error);
        }
    },

    loadEditCatogory: async (req, res, next) => {
        try {
            const id = req.query.id;
            const catRow = await Category._Model.findByPk(id);
            if (catRow) return res.render('editCategory', { category: plainWithUnderscoreId(catRow) });
            res.redirect('/admin/viewCategory');
        } catch (error) {
            next(error);
        }
    },

    editCategory: async (req, res, next) => {
        try {
            const { id, categoryName, categoryDescription, categoryOfferPercentage } = req.body;

            const catRow = await Category._Model.findByPk(id);
            if (!catRow) return res.status(404).json({ error: 'Category not found' });
            const existingCategory = catRow.get({ plain: true });
            if (categoryName !== existingCategory.categoryName) {
                const alreadyExists = await Category._Model.findOne({ where: { categoryName: { [Op.like]: `^${categoryName}$` } } });
                if (alreadyExists) return res.status(401).json({ error: 'Category Already Created' });
            }
            await catRow.update({ categoryName, categoryDescription, categoryOfferPercentage });
            return res.status(200).json({ success: 'Category updated successfully' });
        } catch (error) {
            next(error);
        }
    },

    loadSalesReport: async (req, res, next) => {
        try {
            const startDate = req.query.startDate;
            const endDate = req.query.endDate;

            const where = {};
            if (startDate && endDate) {
                where.orderDate = {
                    [Op.gte]: new Date(startDate),
                    [Op.lte]: new Date(endDate + 'T23:59:59.999Z')
                };
            }

            console.log('loadSalesReport: query where=', where);

            const orders = await Order._Model.findAll({ where });
            console.log('loadSalesReport: orders found=', orders.length);

            // build product and user id sets
            let salesData = [];
            const productIdSet = new Set();
            const userIdSet = new Set();

            const plainOrders = orders.map(o => o.get ? o.get({ plain: true }) : o);
            plainOrders.forEach(o => {
                userIdSet.add(o.user);
                (o.products || []).forEach(p => {
                    if (p && p.productId) productIdSet.add(p.productId);
                });
            });

            const productIds = Array.from(productIdSet).filter(Boolean);
            const products = productIds.length ? await Product._Model.findAll({ where: { id: productIds } }) : [];
            const prodMap = {};
            products.forEach(p => { const pp = p.get({ plain: true }); pp._id = pp.id; prodMap[pp.id] = pp; });

            const userIds = Array.from(userIdSet).filter(Boolean);
            const users = userIds.length ? await User._Model.findAll({ where: { id: userIds } }) : [];
            const userMap = {};
            users.forEach(u => { const up = u.get({ plain: true }); userMap[up.id] = up; });

            // build salesData entries shaped like the template expects
            plainOrders.forEach(o => {
                (o.products || []).forEach(p => {
                    const prod = prodMap[p.productId] || null;
                    const user = userMap[o.user] || null;
                    salesData.push({
                        _id: o.id,
                        orderDate: o.orderDate,
                        totalAmount: o.totalAmount,
                        products: {
                            price: p.price,
                            quantity: p.quantity,
                            orderStatus: p.orderStatus
                        },
                        productDetails: prod ? [prod] : [],
                        userData: user ? [user] : [{ firstName: '' }]
                    });
                });
            });

            console.log('loadSalesReport: salesData length=', salesData.length);

            res.render('salesReport', { salesData, startDate, endDate });
        } catch (error) {
            console.error('Sales report error:', error);
            next(error);
        }
    },

    exportSalesReport: async (req, res, next) => {
        try {
            const formatTime = (date) => {
                const options = {
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    timeZoneName: 'short'
                };
                return new Intl.DateTimeFormat('en-US', options).format(date);
            };

            const startDate = req.query.startDate;
            const endDate = req.query.endDate;

            const where = {};
            if (startDate && endDate) {
                where.orderDate = {
                    [Op.gte]: new Date(startDate),
                    [Op.lte]: new Date(endDate + 'T23:59:59.999Z')
                };
            }

            const orders = await Order._Model.findAll({ where });
            const plainOrders = orders.map(o => o.get ? o.get({ plain: true }) : o);

            // gather product and user ids
            const productIdSet = new Set();
            const userIdSet = new Set();
            plainOrders.forEach(o => { userIdSet.add(o.user); (o.products || []).forEach(p => { if (p && p.productId) productIdSet.add(p.productId); }); });

            const productIds = Array.from(productIdSet).filter(Boolean);
            const products = productIds.length ? await Product._Model.findAll({ where: { id: productIds } }) : [];
            const prodMap = {};
            products.forEach(p => { const pp = p.get({ plain: true }); pp._id = pp.id; prodMap[pp.id] = pp; });

            const userIds = Array.from(userIdSet).filter(Boolean);
            const users = userIds.length ? await User._Model.findAll({ where: { id: userIds } }) : [];
            const userMap = {};
            users.forEach(u => { const up = u.get({ plain: true }); userMap[up.id] = up; });

            const excelData = [];
            plainOrders.forEach(o => {
                const user = userMap[o.user] || { firstName: '' };
                (o.products || []).forEach(p => {
                    const prod = prodMap[p.productId] || {};
                    excelData.push({
                        'Order ID': o.id,
                        'Username': user.firstName || '',
                        'Product': prod.productName || '',
                        'Category': prod.productCategory || '',
                        'Price': new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(p.price != null ? p.price : 0)),
                        'Quantity': p.quantity || '',
                        'Order Date': o.orderDate ? (new Date(o.orderDate)).toDateString() : '',
                        'Time': o.orderDate ? formatTime(new Date(o.orderDate)) : '',
                        'Order Status': p.orderStatus || '',
                    });
                });
            });

            const json2csvParser = new Parser();
            const csv = json2csvParser.parse(excelData);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.csv');
            res.status(200).send(csv);
        } catch (error) {
            console.error('Export sales report error:', error);
            next(error);
        }
    },

    load500: async (req, res, next) => {
        try {
            res.render('500');
        } catch (error) {
            next(error);
        }
    },

    load404: async (req, res, next) => {
        try {
            res.render('404');
        } catch (error) {
            next(error);
        }
    },
};