const mongoose = require("mongoose");
const Wallet = require("../models/walletModel");

const transactionSchema = new mongoose.Schema({
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Wallet",
    required: true,
  },
  transactionType: {
    type: String,
    enum: ["credit", "debit"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01, 
  },
  previousBalance: {
    type: Number,
    required: true,
  },
  newBalance: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: false, 
  },
  transactionId: {
    type: String,
    required: true,
    unique: true, 
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
}, { timestamps: true });

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
