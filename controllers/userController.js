const sequelize = require('../db');
const User = require('../models/userModel');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const otpGenerator = require("otp-generator");
const randomstring = require('randomstring');


const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;
    } catch (error) {
        handleDatabaseError(error);
    }
};

const otpSent = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Verify Your Email',
            html: `<p>Your OTP is: <strong>${otp}</strong></p>`,
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.log(error.message);
    }
};

//for sending recovery mail
const resetPasswordMail = async (username, email, token) => {
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            }
        })

        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: "For Reset Password",
            html: `<p> Hi, ${username}, please click here to <a href="http://localhost:5000/forgotPassword?token=${token}"> Reset </a> your password</p>`
        }

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                next(error);
            } else {
                console.log("Email Has been Sent:-", info, response);
            }
        })

    } catch (error) {
        next(error);
    }
};

module.exports = {
    loadLogin: async (req, res, next) => {
        try {
            res.render('login');
        } catch (error) {
            next(error);
        }
    },

    loginLoad: async (req, res, next) => {
        try {
            res.render('login');
        } catch (error) {
            next(error);
        }
    },

    verifyLogin: async (req, res, next) => {
    try {
        const email = req.body.email;
        const password = req.body.password;

        const userRow = await User._Model.findOne({ where: { email } });
        const user = userRow && userRow.get ? userRow.get({ plain: true }) : null;
        if (!user) return res.status(404).json({ error: 'User not found' });
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: "Incorrect Password" });
        }

        if (user.isBlocked) {
            return res.status(401).json({
                error: "Your account is blocked. Please contact support for assistance."
            });
        }

        if (!user.isVerified) {
            return res.status(401).json({
                error: "Please verify your OTP before login."
            });
        }

        req.session.userId = user.id;
        return res.status(200).json({ success: "Login successful" });

    } catch (error) {
        next(error);
    }
},

    loadForget: async (req, res, next) => {
        try {
            res.render('forgetPassword');
        } catch (error) {
            next(error);
        }
    },

    forgotVerify: async (req, res, next) => {
        try {
            const email = req.body.email;
            const userRow = await User._Model.findOne({ where: { email } });
            if (userRow) {
                const userData = userRow.get({ plain: true });
                if (userData.isVerified === false) return res.render('forgetPassword', { message: 'Please verify your mail' });
                const randomString = randomstring.generate();
                await User._Model.update({ token: randomString }, { where: { email } });
                resetPasswordMail(userData.firstName, userData.email, randomString);
                return res.render('forgetPassword', { message: 'Please Check Your Mail to Reset Your Password' });
            }
            return res.render('forgetPassword', { message: 'User email is Incorrect' });
        } catch (error) {
            next(error);
        }
    },

    loadForgotPassword: async (req, res, next) => {
        try {
            const token = req.query.token;
            const userRow = await User._Model.findOne({ where: { token } });
            if (userRow) return res.render('forgotPassword', { user_id: userRow.get({ plain: true }).id });
            res.render('forgotPassword', { message: 'Invalid Token' });
        } catch (error) {
            next(error);
        }
    },

    //Resetting Password  
    forgotPassword: async (req, res, next) => {
        try {
            const id = req.body.id;

            if (!id) {
                return res.status(400).send('User ID is missing in the form submission');
            }

            // You may want to validate the password and confirm password fields here
            const password = req.body.password;

            // Hash the new password before saving it to the database
            const hashedPassword = await bcrypt.hash(password, 10);

            const [updated] = await User._Model.update({ password: hashedPassword }, { where: { id } });
            if (!updated) return res.status(404).send('User not found in the database');

            res.render("login", { message: "Password Changed Successfully, Proceed To Sign In" });

        } catch (error) {
            next(error);
        }
    },

    loadRegister: async (req, res, next) => {
        try {
            res.render('registration');
        } catch (error) {
            next(error);
        }
    },

    userLogout: async (req, res, next) => {
        try {
            req.session.destroy()
            res.redirect('/')
        } catch (error) {
            next(error);
        }
    },

    loadOtp: async (req, res, next) => {
        try {
            res.render('otp');
        } catch (error) {
            next(error);
        }
    },

    insertUser: async (req, res, next) => {
        try {
            const otp = otpGenerator.generate(6, { upperCase: false, specialChars: false });
            const currentTime = new Date();
            const otpCreationTime = currentTime.getMinutes()
            req.session.otp = {
                code: otp,
                creationTime: otpCreationTime,
            };

            const { passwordConfirm, password, mobileno, email, lastName, firstName } = req.body
            req.session.email = email
            const userCheckRow = await User._Model.findOne({ where: { email } });
            if (userCheckRow) return res.json({ success: false, message: 'Email already exists' });

            // else continue
            
                const hashedPassword = await securePassword(password);

                if (firstName && email && lastName && mobileno) {
                    if (password === passwordConfirm) {

                        const resultRow = await User._Model.create({ firstName, lastName, email, mobileno, password: hashedPassword });
                        otpSent(email, req.session.otp.code);
                        res.json({ success: true, message: 'User registered successfully' });
                    } else {
                        res.json({ success: false, message: "Password doesn't match" });
                    }
                } else {
                    res.json({ success: false, message: "Please enter all details" });
                }
            
        } catch (error) {
            next(error);
        }
    },

    loadHome: async (req, res, next) => {
        try {
            const { category: selectedCategory, sort, search } = req.query;

            // If DB is not connected, render the page with empty/default data instead of throwing
            if (!global.__DB_CONNECTED) {
                console.warn('Database not connected — rendering homepage with empty data');
                return res.render('userHome', {
                    product: [],
                    Digital: null,
                    Smart: null,
                    Analog: null,
                    category: [],
                    currentSort: sort,
                    selectedCategory,
                    search,
                    message: 'Running in offline mode — database is not available.'
                });
            }

            const { Op } = require('sequelize');
            const categoriesRows = await Category._Model.findAll({ where: { isListed: true } });
            const categories = categoriesRows.map(c => c.get({ plain: true }));
            const filterCriteria = {};

            if (selectedCategory) {
                const categoryObject = await Category._Model.findOne({
                    where: { categoryName: { [Op.like]: `%${selectedCategory}%` } }
                });

                if (categoryObject) {
                    filterCriteria.productCategory = categoryObject.id;
                }
            }

            // Add search functionality
            if (search) {
                filterCriteria.productName = { [Op.like]: `%${search}%` };
            }

            // build order array for Sequelize
            const order = [];
            if (sort === 'lowtohigh') order.push(['discountedPrice', 'ASC']);
            else if (sort === 'hightolow') order.push(['discountedPrice', 'DESC']);

            const productsRows = await Product._Model.findAll({ where: filterCriteria, order });
            const productsPlain = productsRows.map(p => p.get({ plain: true }));

            // populate productCategory manually
            const categoryIds = [...new Set(productsPlain.map(p => p.productCategory).filter(Boolean))];
            const categoryMap = {};
            if (categoryIds.length) {
                const cats = await Category._Model.findAll({ where: { id: categoryIds } });
                cats.forEach(c => { categoryMap[c.id] = c.get({ plain: true }); });
            }
            productsPlain.forEach(p => { p.productCategory = categoryMap[p.productCategory] || null; });

            const Analog = await Category._Model.findOne({ where: { categoryName: 'Analog' } });
            const Smart = await Category._Model.findOne({ where: { categoryName: 'Smart' } });
            const Digital = await Category._Model.findOne({ where: { categoryName: 'Digital' } });

            res.render('userHome', { product: productsPlain, Digital: Digital && Digital.get({ plain: true }), Smart: Smart && Smart.get({ plain: true }), Analog: Analog && Analog.get({ plain: true }), category: categories, currentSort: sort, selectedCategory, search });
        } catch (error) {
            next(error);
        }
    },


    verifyOTP: async (req, res, next) => {
        try {
            const enteredOTP = req.body.otp;
            const storedOTP = req.session.otp.code;
            const otpCreationTime = req.session.otp.creationTime;
            const email = req.session.email

            const currentTimeFull = new Date();
            const currentTime = currentTimeFull.getMinutes()

            const timeDiff = (currentTime - otpCreationTime);

            if (enteredOTP === storedOTP && timeDiff <= 1) {
                    const userRow = await User._Model.findOne({ where: { email } });
                    if (userRow) {
                        await userRow.update({ isVerified: true });
                        return res.render('login', { message: 'Registration successful' });
                    }
                    return res.render('otp', { message: 'User not found' });
            } else {
                res.render('otp', { message: "Invalid OTP or OTP has expired" });
            }
        } catch (error) {
            next(error);
        }
    },

    resendOTP: async (req, res, next) => {
        try {
            const newOTP = otpGenerator.generate(6, { upperCase: false, specialChars: false });
            req.session.otp.code = newOTP;
            const currentTime = new Date();
            req.session.otp.creationTime = currentTime.getMinutes()
            otpSent(req.session.email, req.session.otp.code);

            res.render("otp", { message: "OTP resent successfully" });
        } catch (error) {
            next(error);
        }
    },
};
