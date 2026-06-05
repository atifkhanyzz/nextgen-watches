# NextGen Watches Cleanup Report

## Removed files

- controllers/couponController.js
- controllers/walletController.js
- models/couponModel.js
- models/walletModel.js
- views/admin/addCoupon.ejs
- views/admin/editCoupon.ejs
- views/admin/viewCoupon.ejs
- views/users/wallet.ejs
- node_modules/
- package-lock.json (removed because it referenced deleted payment packages; regenerate with npm install)

## Removed integrations

- Razorpay payment gateway
- Wallet top-up/payment/refund flow
- Coupon application flow
- Razorpay script from user footers
- Payment selection UI from checkout
- Coupon UI from checkout
- Wallet UI from profile
- Coupon menu from admin sidebar

## Updated behavior

- Checkout now places a manual order after selecting a shipping address.
- No customer payment method is shown.
- Orders no longer require or store a customer-selected payment method.
- Order stock is reduced on placement and restored on cancellation.
- Admin can continue managing products, users, categories, orders, and sales reports.

## Files changed

- controllers/checkoutController.js
- controllers/orderController.js
- controllers/profileController.js
- controllers/userController.js
- controllers/wishlistController.js
- routes/userRoute.js
- routes/adminRoute.js
- models/userModel.js
- models/orderModel.js
- views/users/checkout.ejs
- views/users/userProfile.ejs
- views/users/orderDetails.ejs
- views/users/registration.ejs
- views/users/layouts/footer.ejs
- views/users/layouts/footer2.ejs
- views/admin/layouts/sideBar.ejs
- views/admin/layouts/footer.ejs
- views/admin/orders.ejs
- views/admin/salesReport.ejs
- package.json
- .env
- README.md
