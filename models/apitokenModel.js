const mongoose = require("mongoose");
const User = require("../models/userModel");

const apiTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: [true, "Token is required"],  
  },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',  
  },
  updatedAt: {  
    type: Date,
    default: Date.now,  
  },
  active: {
    type: Boolean,
    default: true,
    select: false,  
  },
});

const ApiToken = mongoose.model("ApiToken", apiTokenSchema);
module.exports = ApiToken;
