const mongoose = require("mongoose");
const Warehouse = require("./warehouseModel");

const productSchema = new mongoose.Schema({
  waybillId: {
    type: String,
    required: true,
    unique: true,
    match: /^\d{12}$/, 
  },
  orderId: {
    type: String, 
    required: true,
    unique: true,
  },
  Warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Warehouse",
  },
}, { timestamps: true }); 

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
