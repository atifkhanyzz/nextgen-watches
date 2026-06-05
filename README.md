# NextGen Watches

NextGen Watches is a full-stack watch e-commerce web application built with Express.js, EJS, MongoDB, Mongoose, and session-based authentication.

## Core Features

### Customer
- Register, OTP verification, login, logout
- Browse watches
- Search and sort products
- View product details
- Add to cart
- Add to wishlist
- Manage profile and saved addresses
- Place manual orders without online payment gateway
- View order history and order details
- Cancel eligible orders

### Admin
- Admin login/logout
- Dashboard
- Manage users
- Manage categories
- Add, edit, view, list/unlist, and delete products
- Upload product images
- Manage orders and order statuses
- Sales report export

## Removed From Original Project

The following payment-related systems were removed for the NextGen Watches requirements:
- Razorpay gateway
- Wallet system
- Coupon system
- Razorpay client scripts
- Wallet routes/views/models/controllers
- Coupon routes/views/models/controllers

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create/update `.env`:

```env
MONGO_URL=<your-mongodb-uri>
PORT=3000
SMTP_USER=<your-smtp-email>
SMTP_PASS=<your-smtp-password>
```

3. Run in development:

```bash
npm run dev
```

4. Run in production mode:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Admin panel:

```text
http://localhost:3000/admin
```
