const mongoose = require("mongoose");
const User = require("../models/userModel");

const orderSchema = new mongoose.Schema({
  orderUniqueId: {
    type: String,
    required: true,
    unique: true,
  },
  receiverName: {
    type: String,
    required: true,
  },
  fullAddress: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
    match: /^[0-9]{10,15}$/, 
  },
  email: {
    type: String,
    required: true,
    match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 
  },
  paymentMode: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Warehouse",
    required: true,
  },
  totalShippingCharges: {
    type: Number,
    required: true,
    default: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  weight: {
    type: Number,
    required: true,
    default: 0, 
  },
  orderStatus: {
    type: String,
  },
  orderDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
}, { timestamps: true }); 

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
