CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(10) CHECK (role IN ('admin', 'client')) DEFAULT 'client',
    contact_number VARCHAR(20),
    is_password_updated BOOLEAN DEFAULT FALSE,
    margin NUMERIC DEFAULT 0,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE user_otps (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp INT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pincode_serviceability (
    id SERIAL PRIMARY KEY,
    pincode VARCHAR(10) NOT NULL UNIQUE CHECK (pincode ~ '^[0-9]{6,10}$'),
    is_serviceable BOOLEAN DEFAULT FALSE,
    city VARCHAR(255),
    state VARCHAR(255),
    country VARCHAR(255),
    last_checked_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) CHECK (currency IN ('USD', 'EUR', 'INR', 'GBP', 'JPY')) DEFAULT 'INR',
    status VARCHAR(10) CHECK (status IN ('active', 'suspended', 'closed')) DEFAULT 'active'
);

CREATE TABLE api_tokens (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL,
    updated_by INT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE warehouses (
    id SERIAL PRIMARY KEY,
    facility_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    pickup_location VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    address_line VARCHAR(255) NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    city VARCHAR(255) NOT NULL,
    state VARCHAR(255) NOT NULL,
    country VARCHAR(255) NOT NULL,
    default_pickup_slot VARCHAR(255) NOT NULL,
    working_days TEXT[],
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    return_address_same_as_pickup BOOLEAN DEFAULT FALSE,
    return_address VARCHAR(255),
    return_pincode VARCHAR(6),
    return_city VARCHAR(255),
    return_state VARCHAR(255),
    return_country VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    sku_code VARCHAR(255) UNIQUE NOT NULL,
    category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    price NUMERIC NOT NULL,
    discount_type VARCHAR(10) CHECK (discount_type IN ('percentage', 'amount')),
    discount NUMERIC DEFAULT 0,
    product_image TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    mobile_number VARCHAR(15) NOT NULL CHECK (mobile_number ~ '^[0-9]{10,15}$'),
    shipping_address_line1 VARCHAR(255) NOT NULL,
    shipping_address_line2 VARCHAR(255),
    shipping_city VARCHAR(255) NOT NULL,
    shipping_state VARCHAR(255) NOT NULL,
    shipping_pincode VARCHAR(10) NOT NULL CHECK (shipping_pincode ~ '^[0-9]{6,10}$'),
    shipping_same_as_billing BOOLEAN DEFAULT FALSE,
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(255),
    billing_state VARCHAR(255),
    billing_pincode VARCHAR(10) CHECK (billing_pincode ~ '^[0-9]{6,10}$'),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_unique_id VARCHAR(255) UNIQUE NOT NULL,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    payment_mode VARCHAR(255) NOT NULL,
    order_date TIMESTAMP DEFAULT NOW(),
    packages_count INT NOT NULL CHECK (packages_count >= 1),
    total_cod_amount NUMERIC DEFAULT 0,
    upload_wbn TEXT 
);

CREATE TABLE shipments (
    id SERIAL PRIMARY KEY,
    tracking_number VARCHAR(255) UNIQUE NOT NULL,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_details JSONB NOT NULL,
    shipment_status VARCHAR(50) DEFAULT 'pending',
    waybill VARCHAR(255) UNIQUE NOT NULL,
    cod_amount NUMERIC DEFAULT 0,
    weight NUMERIC DEFAULT 0 NOT NULL CHECK (weight >= 0),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wallet_recharge (
    id SERIAL PRIMARY KEY,
    wallet_id INT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    transaction_type VARCHAR(10) CHECK (transaction_type IN ('credit', 'debit')) NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0.01),
    description TEXT,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(10) CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE waybills (
    id SERIAL PRIMARY KEY,
    waybill_id VARCHAR(12) UNIQUE NOT NULL CHECK (waybill_id ~ '^[0-9]{12}$'),
    order_id VARCHAR(255) UNIQUE NOT NULL,
    warehouse_id INT REFERENCES warehouses(id) ON DELETE SET NULL
);

CREATE TABLE user_bank_accounts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_holder_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) UNIQUE NOT NULL,
    ifsc_code VARCHAR(20) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    branch_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE api_logs (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    request_type VARCHAR(10) CHECK (request_type IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')) NOT NULL,
    payload JSONB,
    response JSONB,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert admin user
INSERT INTO users (name, email, password, role) VALUES
('Admin', 'admin@example.com', 'hashedpassword', 'admin');


format=json&data={
  "shipments": [
    {
      "name": "Bhushan K", 
      "add": "500, shri nivas",  
      "city": "Pune", 
      "state": "Maharashtra",  
      "country": "India", 
      "pin": 412207,  
      "phone": "9975359779",  
      "payment_mode": "prepaid", 
      "order": "35968298625986",  
      "shipping_mode": "Surface", 
      "weight": "500",  
      "fragile_shipment": "false",   
      "cod_amount": 0,  
      "plastic_packaging": "true",
      "shipment_height": 10,
      "shipment_width": 11,
      "shipment_length": 12,
      "qc": {
          "item": [
            {
              "descr": "description of the product",
              "brand": "Brand of the product",
              "pcat": "Product category like mobile, apparels etc.",
              "item_quantity": 2
            },
            {
              "descr": "description of the product",
              "brand": "Brand of the product",
              "pcat": "Product category like mobile, apparels etc.",
              "item_quantity": 1
            }
          ]
        },
    }
  ],
  "pickup_location": {
    "name": "Manas Warehouse Test3", 
    "city": "Pune",  
    "pin": "411011",  
    "country": "India",  
    "phone": "9975359779",  
    "add": "404 Somwar Peth" 
  }
}


