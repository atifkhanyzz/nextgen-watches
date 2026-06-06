const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const fs = require("fs");
const sharp = require('sharp');
const path = require('path');

const productImagesDir = path.join(__dirname, '../public/productImages');

function ensureImageDirectory() {
    if (!fs.existsSync(productImagesDir)) {
        fs.mkdirSync(productImagesDir, { recursive: true });
    }
}

function plainWithUnderscoreId(row) {
    const p = row.get({ plain: true });
    p._id = p.id;
    return p;
}

function ensureArrayField(field) {
    if (Array.isArray(field)) return field;
    if (!field) return [];
    if (typeof field === 'string') {
        try {
            let parsed = JSON.parse(field);
            // Handle double-serialized JSON strings like '"[\"...\"]"'
            if (typeof parsed === 'string') {
                try {
                    const parsed2 = JSON.parse(parsed);
                    parsed = parsed2;
                } catch (e) {
                    // keep parsed as string
                }
            }
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            return [field];
        }
    }
    return [field];
}

async function saveBase64Image(base64Data, filename) {
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const outputPath = path.join(productImagesDir, filename);

    await sharp(buffer)
        .jpeg({ quality: 90 })
        .toFile(outputPath);

    return filename;
}

async function normalizeUploadedImages(files = []) {
    ensureImageDirectory();

    const imageNames = [];

    for (const file of files) {
        // If upload middleware returned a remote URL (Cloudinary), push URL directly
        if (file && file.path && (String(file.path).startsWith('http') || String(file.path).startsWith('https'))) {
            imageNames.push(String(file.path));
            continue;
        }

        // Fallback for local disk storage: move file into productImages folder
        const ext = path.extname(file.originalname) || '.jpg';
        const safeName = `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        const oldPath = file.path;
        const newPath = path.join(productImagesDir, safeName);

        if (oldPath && fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            imageNames.push(safeName);
        }
    }

    return imageNames;
}

async function getProductImages(req) {
    ensureImageDirectory();

    let images = [];

    if (req.files && req.files.length > 0) {
        images = await normalizeUploadedImages(req.files);
    }

    if (images.length === 0) {
        const croppedImages = [
            req.body.croppedImageData1,
            req.body.croppedImageData2,
            req.body.croppedImageData3
        ].filter(Boolean);

        for (let i = 0; i < croppedImages.length; i++) {
            const filename = `product-cropped-${Date.now()}-${i + 1}.jpg`;
            await saveBase64Image(croppedImages[i], filename);
            images.push(filename);
        }
    }

    return images;
}

function calculateDiscountedPrice(price, productOfferPercentage = 0, categoryOfferPercentage = 0) {
    const productOffer = Number(productOfferPercentage) || 0;
    const categoryOffer = Number(categoryOfferPercentage) || 0;
    const highestOfferPercentage = Math.max(productOffer, categoryOffer);
    const discountedPrice = Number(price) - (Number(price) * highestOfferPercentage / 100);

    return {
        highestOfferPercentage,
        discountedPrice
    };
}

module.exports = {
    loadAddProduct: async (req, res, next) => {
        try {
            const categoriesRows = await Category._Model.findAll({ where: { isListed: true } });
            const category = categoriesRows.map(c => plainWithUnderscoreId(c));
            res.render('addProduct', { category });
        } catch (error) {
            next(error);
        }
    },

    addProduct: async (req, res, next) => {
        try {
            console.log('ADD_PRODUCT_FORM', { body: req.body, files: req.files && req.files.length });
            const {
                productName,
                productBrand,
                productDescription,
                productCategory,
                productPrice,
                productStock,
                productOfferPercentage
            } = req.body;

            const categoriesRows = await Category._Model.findAll({ where: { isListed: true } });
            const category = categoriesRows.map(c => plainWithUnderscoreId(c));

            if (!productName || !productBrand || !productDescription || !productCategory || !productPrice || !productStock) {
                return res.render('addProduct', {
                    category,
                    message: 'Please fill all required product fields.'
                });
            }

            const selectedCategory = await Category._Model.findByPk(productCategory);
            const selectedCategoryPlain = selectedCategory && selectedCategory.get({ plain: true });

            if (!selectedCategory) {
                return res.render('addProduct', {
                    category,
                    message: 'Selected category does not exist.'
                });
            }

            const productImage = await getProductImages(req);

            if (!productImage || productImage.length === 0) {
                return res.render('addProduct', {
                    category,
                    message: 'Please upload at least one product image.'
                });
            }

            const price = Number(productPrice);
            const stock = Number(productStock);
            const offer = Number(productOfferPercentage) || 0;

            if (Number.isNaN(price) || price <= 0) {
                return res.render('addProduct', {
                    category,
                    message: 'Product price must be a valid positive number.'
                });
            }

            if (Number.isNaN(stock) || stock < 0) {
                return res.render('addProduct', {
                    category,
                    message: 'Product stock must be a valid number.'
                });
            }

            const discountData = calculateDiscountedPrice(
                price,
                offer,
                selectedCategory.categoryOfferPercentage
            );

            const created = await Product._Model.create({
                productName: productName.trim(),
                productBrand: productBrand.trim(),
                productDescription: productDescription.trim(),
                productCategory,
                productPrice: price,
                productStock: stock,
                productOfferPercentage: offer,
                highestOfferPercentage: discountData.highestOfferPercentage,
                discountedPrice: discountData.discountedPrice,
                productImage,
                isListed: true
            });

            return res.redirect('/admin/viewProduct');
        } catch (error) {
            next(error);
        }
    },

    loadViewProducts: async (req, res, next) => {
        try {
            const page = Number(req.query.page) || 1;
            const pageSize = 6;
            const skip = (page - 1) * pageSize;

            let search = req.query.search || '';
            let query = {};

            if (search) {
                const searchRegex = new RegExp('.*' + search + '.*', 'i');
                query = {
                    $or: [
                        { productName: searchRegex },
                        { productBrand: searchRegex },
                        { productDescription: searchRegex }
                    ]
                };
            }

            const { Op } = require('sequelize');
            const where = {};
            if (search) {
                where[Op.or] = [
                    { productName: { [Op.like]: `%${search}%` } },
                    { productBrand: { [Op.like]: `%${search}%` } },
                    { productDescription: { [Op.like]: `%${search}%` } }
                ];
            }

            const { count: totalProducts, rows } = await Product._Model.findAndCountAll({
                where,
                order: [['createdAt', 'DESC']],
                offset: skip,
                limit: pageSize
            });

            const productsPlain = rows.map(r => {
                const p = r.get({ plain: true });
                p._id = p.id;
                p.productImage = ensureArrayField(p.productImage);
                return p;
            });
            // attach categories
            const catIds = [...new Set(productsPlain.map(p => p.productCategory).filter(Boolean))];
            let catMap = {};
            if (catIds.length) {
                const cats = await Category._Model.findAll({ where: { id: catIds } });
                cats.forEach(c => { const cp = c.get({ plain: true }); cp._id = cp.id; catMap[c.id] = cp; });
            }
            productsPlain.forEach(p => { p.productCategory = catMap[p.productCategory] || null; });

            const totalPages = Math.ceil(totalProducts / pageSize);
            res.render('viewProduct', { data: productsPlain, currentPage: page, totalPages });
        } catch (error) {
            next(error);
        }
    },

    unlistProduct: async (req, res, next) => {
        try {
            const id = req.query.id;
            const product = await Product._Model.findByPk(id);
            if (product) {
                await product.update({ isListed: !product.get('isListed') });
            }

            res.redirect('/admin/viewProduct');
        } catch (error) {
            next(error);
        }
    },

    deleteProduct: async (req, res, next) => {
        try {
            const id = req.query.id;
            const productRow = await Product._Model.findByPk(id);
            if (productRow) {
                const product = productRow.get({ plain: true });
                const imgs = ensureArrayField(product.productImage);
                if (imgs.length > 0) {
                    imgs.forEach(image => {
                        const imagePath = path.join(productImagesDir, image);
                        if (fs.existsSync(imagePath)) {
                            fs.unlinkSync(imagePath);
                        }
                    });
                }
                await Product._Model.destroy({ where: { id } });
            }

            res.redirect('/admin/viewProduct');
        } catch (error) {
            next(error);
        }
    },

    loadEditProduct: async (req, res, next) => {
        try {
            const id = req.query.id;
            const productRow = await Product._Model.findByPk(id);
            const product = productRow && (() => { const x = productRow.get({ plain: true }); x._id = x.id; x.productImage = ensureArrayField(x.productImage); return x; })();
            const categoriesRows = await Category._Model.findAll({ where: { isListed: true } });
            const category = categoriesRows.map(c => plainWithUnderscoreId(c));

            if (!product) {
                return res.redirect('/admin/viewProduct');
            }

            res.render('editProduct', { product, category });
        } catch (error) {
            next(error);
        }
    },

    editProduct: async (req, res, next) => {
        try {
            console.log('EDIT_PRODUCT_FORM', { body: req.body, files: req.files && req.files.length });
            const {
                id,
                productName,
                productDescription,
                productCategory,
                productStock,
                productPrice,
                productBrand,
                productOfferPercentage
            } = req.body;

            const productRow = await Product._Model.findByPk(id);
            const product = productRow && productRow.get({ plain: true });

            if (!product) {
                return res.redirect('/admin/viewProduct');
            }

            const selectedCategoryRow = await Category._Model.findByPk(productCategory);
            const selectedCategory = selectedCategoryRow && selectedCategoryRow.get({ plain: true });

            if (!selectedCategory) {
                const category = await Category.find({ isListed: true });
                return res.render('editProduct', {
                    product,
                    category,
                    message: 'Selected category does not exist.'
                });
            }

            const uploadedImages = await getProductImages(req);

            // Defensive logging for debugging image overwrite issues
            console.log('Existing product images before update:', product.productImage);
            console.log('New files uploaded count:', uploadedImages.length);

            // Parse numeric fields and calculate discounts first
            const price = Number(productPrice);
            const stock = Number(productStock);
            const offer = Number(productOfferPercentage) || 0;

            const discountData = calculateDiscountedPrice(
                price,
                offer,
                selectedCategory.categoryOfferPercentage
            );

            // Build update payload and only include productImage if new images were uploaded.
            const updatePayload = {
                productName: productName.trim(),
                productDescription: productDescription.trim(),
                productCategory,
                productStock: stock,
                productPrice: price,
                productBrand: productBrand.trim(),
                productOfferPercentage: offer,
                highestOfferPercentage: discountData.highestOfferPercentage,
                discountedPrice: discountData.discountedPrice
            };

            if (uploadedImages && uploadedImages.length > 0) {
                updatePayload.productImage = uploadedImages;
            }

            await Product._Model.update(updatePayload, { where: { id } });

            // Re-fetch product from DB to confirm what was saved
            try {
                const refreshed = await Product._Model.findByPk(id);
                const refreshedPlain = refreshed && refreshed.get ? refreshed.get({ plain: true }) : null;
                console.log('Product after update (db):', refreshedPlain && JSON.stringify(refreshedPlain.productImage));
            } catch (err) {
                console.error('Error re-fetching product after update:', err);
            }

            res.redirect('/admin/viewProduct');
        } catch (error) {
            next(error);
        }
    },

    loadUserProducts: async (req, res, next) => {
        try {
            const { category: selectedCategory, sort, search, page } = req.query;
            const { Op } = require('sequelize');
            const categoriesRows = await Category._Model.findAll({ where: { isListed: true } });
            const categories = categoriesRows.map(c => c.get({ plain: true }));

            const itemsPerPage = 8;
            const currentPage = Number(page) || 1;
            const skip = (currentPage - 1) * itemsPerPage;

            const where = { isListed: true };

            if (selectedCategory) {
                const categoryObject = await Category._Model.findOne({ where: { categoryName: { [Op.like]: `%${selectedCategory}%` }, isListed: true } });
                if (categoryObject) where.productCategory = categoryObject.id;
            }

            if (search) {
                where.productName = { [Op.like]: `%${search}%` };
            }

            const order = [['createdAt', 'DESC']];
            if (sort === 'lowtohigh') order.unshift(['discountedPrice', 'ASC']);
            else if (sort === 'hightolow') order.unshift(['discountedPrice', 'DESC']);

            const { count: totalProducts, rows } = await Product._Model.findAndCountAll({ where, order, offset: skip, limit: itemsPerPage });
            const productsPlain = rows.map(r => { const p = r.get({ plain: true }); p._id = p.id; p.productImage = ensureArrayField(p.productImage); return p; });
            // attach categories
            const catIds = [...new Set(productsPlain.map(p => p.productCategory).filter(Boolean))];
            let catMap = {};
            if (catIds.length) {
                const cats = await Category._Model.findAll({ where: { id: catIds } });
                cats.forEach(c => { const cp = c.get({ plain: true }); cp._id = cp.id; catMap[c.id] = cp; });
            }
            productsPlain.forEach(p => { p.productCategory = catMap[p.productCategory] || null; });

            res.render('productView', {
                product: productsPlain,
                category: categories,
                currentSort: sort,
                selectedCategory,
                search,
                currentPage,
                totalPages: Math.ceil(totalProducts / itemsPerPage)
            });
        } catch (error) {
            next(error);
        }
    },

    loadUserProductDetails: async (req, res, next) => {
        try {
            const id = req.query.id;
            const productRow = await Product._Model.findByPk(id);
            const product = productRow && productRow.get({ plain: true });

            if (!product) {
                return res.redirect('/productView');
            }

            const catRow = await Category._Model.findByPk(product.productCategory);
            product.productCategory = catRow && catRow.get({ plain: true }) || null;
            product.productImage = ensureArrayField(product.productImage);
            console.log('PRODUCT_DETAILS productImage type:', typeof product.productImage, 'isArray:', Array.isArray(product.productImage), 'value:', product.productImage);

            res.render('productDetails', { product });
        } catch (error) {
            next(error);
        }
    },
};