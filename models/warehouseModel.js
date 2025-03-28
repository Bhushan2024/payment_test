const mongoose = require("mongoose");
const { Schema } = mongoose;
const User = require("../models/userModel");

const warehouseSchema = new Schema(
  {
    facilityName: {
      type: String,
      required: true,
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    pickupLocation: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    },
    addressLine: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      match: [/^\d{6}$/, "Invalid pincode format"],
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    defaultPickupSlot: {
      type: String,
      required: true,
    },
    workingDays: {
      type: [String],
      enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    returnAddressSameAsPickup: {
      type: Boolean,
      default: false,
    },
    returnAddress: {
      type: String,
      trim: true,
    },
    returnPincode: {
      type: String,
      match: [/^\d{6}$/, "Invalid pincode format"],
    },
    returnCity: {
      type: String,
      trim: true,
    },
    returnState: {
      type: String,
      trim: true,
    },
    returnCountry: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Warehouse = mongoose.model("Warehouse", warehouseSchema);
module.exports = Warehouse;
