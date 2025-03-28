const mongoose = require("mongoose");
const User = require("../models/userModel");

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true, 
  },
  balance: {
    type: Number,
    required: true,
    default: 0, 
  },
  currency: {
    type: String,
    required: true,
    default: "INR", 
    enum: ["USD", "EUR", "INR", "GBP", "JPY"], 
  },
  status: {
    type: String,
    enum: ["active", "suspended", "closed"],
    default: "active",
  },
}, { timestamps: true }); 

const Wallet = mongoose.model("Wallet", walletSchema);
module.exports = Wallet;
