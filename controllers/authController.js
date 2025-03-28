const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { pgPool, query } = require("../pgadmin");
const AppError = require("../utils/appError");
const sendAddClientMail = require("../helpers/addClientMail");
const sendOTPEmail = require("../helpers/sendOTPEmail");
const crypto = require("crypto");

// Helper function to create JWT token
const createToken = (id, role) => {
  return jwt.sign(
    {
      id,
      role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    },
  );
};

// Helper function to compare passwords
const correctPassword = async (candidatePassword, userPassword) => {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Helper function to hash password
const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    // 1) Check if email and password exist
    if (!email || !password) {
      return next(
        new AppError(404, "fail", "Please provide proper email or password"),
        req,
        res,
        next,
      );
    }

    // 2) Check if user exists and password is correct
    const userResult = await query(
      'SELECT id, name, email, password, role, contact_number, is_password_updated, margin, active FROM users WHERE email = $1',
      [email]
    );
    
    const user = userResult.rows[0];
    
    if (!user || !(await correctPassword(password, user.password))) {
      return next(
        new AppError(401, "fail", "Email or Password is wrong"),
        req,
        res,
        next,
      );
    }

    // 3) All correct, send jwt to client
    const token = createToken(user.id, user.role);
    
    // Remove the password from the output
    delete user.password;
    
    res.status(200).json({
      status: "success",
      token,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          contactNumber: user.contact_number,
          isPasswordUpdated: user.is_password_updated,
          margin: user.margin,
          active: user.active
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.signup = async (req, res, next) => {
  try {
    const { name, email, role, contactNumber, margin } = req.body;
    const allowedRoles = ["admin", "client"];
    
    if (!name || !contactNumber) {
      return res.status(400).json({
        status: "fail",
        message: "Name and Contact Number are required.",
      });
    }
    
    // Validate role
    const userRole = role?.toLowerCase() || "client";
    if (!allowedRoles.includes(userRole)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid role. Allowed roles: admin, client.",
      });
    }
    
    // Validate email format
    if (email && !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid email format.",
      });
    }
    
    // Check if email already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        status: "fail",
        message: "Email already exists. Please use a different email.",
      });
    }
    
    // Generate password
    const rawPassword = generatePassword(name, contactNumber);
    const hashedPassword = await hashPassword(rawPassword);
    
    // Create user in PostgreSQL
    const userResult = await query(
      'INSERT INTO users (name, email, password, role, contact_number, margin) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, contact_number, is_password_updated, margin, active',
      [name, email, hashedPassword, userRole, contactNumber, margin || 0]
    );
    
    const user = userResult.rows[0];

    const wallet_status = 'active';
    
    // Create wallet for user
    const walletResult = await query(
      'INSERT INTO wallets (user_id, currency, status) VALUES ($1, $2, $3) RETURNING id, user_id, currency, status',
      [user.id, 'INR', 'active']
    );
    
    const wallet = walletResult.rows[0];
    
    // Send email notification
    await sendAddClientMail(email, name, rawPassword);
    
    return res.status(201).json({
      status: "success",
      data: { 
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          contactNumber: user.contact_number,
          isPasswordUpdated: user.is_password_updated,
          margin: user.margin,
          active: user.active
        }, 
        wallet: {
          id: wallet.id,
          userId: wallet.user_id,
          balance: wallet.balance,
          currency: wallet.currency
        } 
      },
    });
  } catch (err) {
    console.error("Signup Error:", err);
    next(err);
  }
};

const generatePassword = (name, contactNumber) => {
  const firstWordOfName = name.split(" ")[0] || "User";
  const firstFourDigits = contactNumber?.substring(0, 4) || "0000";
  return `${firstWordOfName}@${firstFourDigits}`;
};

exports.forgetPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide a valid email",
      });
    }

    // Check if user exists in PostgreSQL
    const userResult = await query('SELECT id, email FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User with this email does not exist",
      });
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Store OTP in PostgreSQL
    await query(
      'INSERT INTO user_otps (user_id, otp, expires_at) VALUES ($1, $2, $3)',
      [user.id, otp, expiresAt]
    );

    // Send OTP email
    await sendOTPEmail(user.email, otp);

    res.status(200).json({
      status: "success",
      message: "OTP sent to your email. Please verify within 10 minutes.",
    });
  } catch (err) {
    next(err);
  }
};

//Verify OTp from forget Password
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp, newPassword, confirmNewPassword } = req.body;

    if (!email || !otp || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide email, OTP, and new passwords",
      });
    }

    // Fetch user from PostgreSQL
    const userResult = await query('SELECT id FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Fetch the latest OTP entry for the user
    const otpResult = await query(
      `SELECT otp, expires_at FROM user_otps 
       WHERE user_id = $1 AND is_verified = FALSE 
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );
    const storedOTP = otpResult.rows[0];

    if (!storedOTP) {
      return res.status(400).json({
        status: "fail",
        message: "No OTP found for this user",
      });
    }

    // Convert stored OTP expiration time to IST format for accurate comparison
    const storedExpiresAt = new Date(storedOTP.expires_at).toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const currentISTTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    if (storedOTP.otp !== otp || new Date(storedExpiresAt) < new Date(currentISTTime)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid or expired OTP",
      });
    }

    // Validate new password and confirm password
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        status: "fail",
        message: "New password and confirm password do not match",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password in PostgreSQL
    await query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);

    // Mark OTP as verified
    await query('UPDATE user_otps SET is_verified = TRUE WHERE user_id = $1 AND otp = $2', [user.id, otp]);

    res.status(200).json({
      status: "success",
      message: "Password updated successfully",
    });
  } catch (err) {
    next(err);
  }
};



//Controller for update first time password
exports.updatePassword = async (req, res, next) => {
  try {
    const { email, oldPassword, newPassword, confirmNewPassword } = req.body;

    if (!email || !oldPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide email, old password, new password, and confirm password",
      });
    }

    // Fetch user from PostgreSQL
    const userResult = await query('SELECT id, password FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Check if old password is correct
    const isCorrectOldPassword = await bcrypt.compare(oldPassword, user.password);
    if (!isCorrectOldPassword) {
      return res.status(401).json({
        status: "fail",
        message: "Incorrect old password",
      });
    }

    // Validate new password and confirm password
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        status: "fail",
        message: "New password and confirm password do not match",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password in PostgreSQL
    await query('UPDATE users SET password = $1, is_password_updated = TRUE WHERE email = $2', [hashedPassword, email]);

    res.status(200).json({
      status: "success",
      message: "Password updated successfully",
    });
  } catch (err) {
    next(err);
  }
};




