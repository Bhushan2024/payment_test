const mongoose = require("mongoose");
const Warehouse = require("../models/warehouseModel");

const productSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true,
  },
  skuCode: {
    type: String,
    required: true,
    unique: true,
  },
  category: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  discountType: {
    type: String,
    enum: ["percentage", "amount"],
    default: null, 
  },
  discount: {
    type: Number,
    default: 0, 
  },
  productImage: {
    type: String, 
    default: null, 
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    default: null, 
  },
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
 