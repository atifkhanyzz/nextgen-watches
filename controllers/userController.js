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

// Normalizer for boolean-like values stored in DB
function isTrueValue(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
}

const otpSent = async (email, otp) => {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('SMTP credentials missing');
        console.log('SMTP_USER exists:', !!process.env.SMTP_USER);
        console.log('SMTP_PASS exists:', !!process.env.SMTP_PASS);
        // In development, allow a local transport so tests can proceed without real SMTP
        if (process.env.NODE_ENV !== 'production') {
            console.log('Running in development: using jsonTransport for OTP email (no external SMTP)');
            try {
                const transporter = nodemailer.createTransport({ jsonTransport: true });
                const mailOptions = {
                    from: process.env.SMTP_USER || 'dev@example.com',
                    to: email,
                    subject: 'Your OTP Verification Code',
                    html: `<p>Your OTP is: <strong>${otp}</strong></p>`,
                };
                const info = await transporter.sendMail(mailOptions);
                console.log('OTP email (dev) prepared:', info && info.messageId);
                return true;
            } catch (err) {
                console.error('Dev OTP transport failed:', err && err.message);
                return false;
            }
        }
        return false;
    }

    console.log('SMTP_USER exists:', !!process.env.SMTP_USER);
    console.log('SMTP_PASS exists:', !!process.env.SMTP_PASS);

    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            connectionTimeout: 20000,
            greetingTimeout: 20000,
            socketTimeout: 20000,
        });

        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Your OTP Verification Code',
            html: `<p>Your OTP is: <strong>${otp}</strong></p>`,
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log('OTP email sent successfully:', info && info.messageId);
            return true;
        } catch (error) {
            console.error('OTP email sending failed:', {
                message: error && error.message,
                code: error && error.code,
                command: error && error.command,
            });
            return false;
        }
    } catch (error) {
        console.error('Failed to create transporter or send OTP:', {
            message: error && error.message,
            code: error && error.code,
            command: error && error.command,
        });
        return false;
    }
};

//for sending recovery mail
const resetPasswordMail = async (username, email, token) => {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('SMTP credentials missing');
        console.log('SMTP_USER exists:', !!process.env.SMTP_USER);
        console.log('SMTP_PASS exists:', !!process.env.SMTP_PASS);
        return false;
    }

    console.log('SMTP_USER exists:', !!process.env.SMTP_USER);
    console.log('SMTP_PASS exists:', !!process.env.SMTP_PASS);

    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            connectionTimeout: 20000,
            greetingTimeout: 20000,
            socketTimeout: 20000,
        });

        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: 'For Reset Password',
            html: `<p> Hi, ${username}, please click here to <a href="http://localhost:5000/forgotPassword?token=${token}"> Reset </a> your password</p>`,
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log('Password reset email sent:', info && info.messageId);
            return true;
        } catch (error) {
            console.error('Password reset email sending failed:', {
                message: error && error.message,
                code: error && error.code,
                command: error && error.command,
            });
            return false;
        }
    } catch (error) {
        console.error('Failed to create transporter for password reset:', {
            message: error && error.message,
            code: error && error.code,
            command: error && error.command,
        });
        return false;
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
        if (user.isDeleted) return res.status(401).json({ error: 'This account has been removed. Please contact support.' });
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
                {
                    const sent = await resetPasswordMail(userData.firstName, userData.email, randomString);
                    if (!sent) return res.render('forgetPassword', { message: 'Password reset email could not be sent. Please try again.' });
                }
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
            // Pass through any message sent via query (e.g. redirect from /otp)
            const message = req.query && req.query.message ? req.query.message : undefined;
            res.render('registration', { message });
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
            // Only render OTP page if there's a pending user in session
            const pendingEmail = req.session.pendingUserEmail;
            const pendingId = req.session.pendingUserId;
            if (!pendingEmail && !pendingId) {
                return res.redirect('/register?message=' + encodeURIComponent('Please complete signup first'));
            }
            res.render('otp');
        } catch (error) {
            next(error);
        }
    },

    insertUser: async (req, res, next) => {
        try {
            const { passwordConfirm, password, mobileno, email, lastName, firstName } = req.body;

            console.log('REGISTER ROUTE HIT');
            console.log('Signup email:', email);

            if (!firstName || !lastName || !email || !mobileno || !password || !passwordConfirm) {
                return res.json({ success: false, message: 'Please enter all details' });
            }

            if (password !== passwordConfirm) return res.json({ success: false, message: "Password doesn't match" });

            const existingUserRow = await User._Model.findOne({ where: { email } });
            const existingUser = existingUserRow ? existingUserRow.get({ plain: true }) : null;
            console.log('Existing user found:', !!existingUser);
            console.log('Raw isVerified:', existingUser ? existingUser.isVerified : null);

            const existingUserVerified = existingUser ? isTrueValue(existingUser.isVerified) : false;
            console.log('Normalized existingUserVerified:', existingUserVerified);

            if (existingUser && existingUserVerified) {
                console.log('Existing verified user found, blocking signup for', email);
                return res.json({ success: false, message: 'User already exists' });
            }

            // Generate OTP
            const otp = otpGenerator.generate(6, { upperCase: false, specialChars: false });

            // Attempt to send OTP first
            const sent = await otpSent(email, otp);
            if (!sent) {
                console.error('OTP email sending failed for', email);
                return res.json({ success: false, message: 'OTP email could not be sent. Please try again.' });
            }

            console.log('OTP email sent successfully');
            if (process.env.NODE_ENV !== 'production') console.log('OTP (dev only):', otp);

            // Email sent. Now create or update unverified user record
            const hashedPassword = await securePassword(password);

            let userRecord;
            if (existingUser) {
                // existing user is unverified — reuse/update
                console.log('Resending OTP for unverified user');
                await User._Model.update({ firstName, lastName, mobileno, password: hashedPassword, isDeleted: false, deletedAt: null }, { where: { email } });
                userRecord = await User._Model.findOne({ where: { email } });
            } else {
                userRecord = await User._Model.create({ firstName, lastName, email, mobileno, password: hashedPassword, isDeleted: false, deletedAt: null });
            }

            const userPlain = userRecord.get({ plain: true });

            // Store pending user info in session AFTER successful send and DB update
            req.session.otp = otp;
            req.session.otpExpires = Date.now() + (5 * 60 * 1000);
            req.session.pendingUserEmail = email;
            req.session.pendingUserId = userPlain.id;

            // Save session and respond so frontend can redirect to /otp
            req.session.save(() => {
                console.log('User saved as unverified:', userPlain.id);
                console.log('Session pendingUserId:', req.session.pendingUserId);
                console.log('Returning redirectUrl /otp');
                return res.json({ success: true, redirectUrl: '/otp', message: 'OTP sent successfully' });
            });

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
            const storedOTP = req.session.otp;
            const otpExpires = req.session.otpExpires;
            const pendingEmail = req.session.pendingUserEmail;
            const pendingId = req.session.pendingUserId;

            if (!storedOTP || !otpExpires || !pendingEmail && !pendingId) {
                return res.redirect('/register?message=' + encodeURIComponent('No pending verification found'));
            }

            if (Date.now() > otpExpires) {
                return res.render('otp', { message: 'OTP has expired. Please resend.' });
            }

            if (enteredOTP === String(storedOTP)) {
                // Find pending user
                let userRow = null;
                if (pendingId) userRow = await User._Model.findOne({ where: { id: pendingId } });
                if (!userRow && pendingEmail) userRow = await User._Model.findOne({ where: { email: pendingEmail } });

                if (userRow) {
                    await userRow.update({ isVerified: true });

                    // Clear session OTP data
                    delete req.session.otp;
                    delete req.session.otpExpires;
                    delete req.session.pendingUserEmail;
                    delete req.session.pendingUserId;

                    return res.render('login', { message: 'Registration successful' });
                }

                return res.render('otp', { message: 'User not found' });
            } else {
                return res.render('otp', { message: 'Invalid OTP or OTP has expired' });
            }
        } catch (error) {
            next(error);
        }
    },

    resendOTP: async (req, res, next) => {
        try {
            const pendingEmail = req.session.pendingUserEmail;
            const pendingId = req.session.pendingUserId;
            if (!pendingEmail && !pendingId) return res.redirect('/register?message=' + encodeURIComponent('No pending verification found'));

            const newOTP = otpGenerator.generate(6, { upperCase: false, specialChars: false });
            req.session.otp = newOTP;
            req.session.otpExpires = Date.now() + (5 * 60 * 1000);

            const sent = await otpSent(pendingEmail, newOTP);
            if (!sent) return res.render('otp', { message: 'OTP email could not be sent. Please try again.' });

            return res.render('otp', { message: 'OTP resent successfully' });
        } catch (error) {
            next(error);
        }
    },
};
