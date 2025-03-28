const nodemailer = require("nodemailer");
require("dotenv").config();

const sendOTPEmail = async (email, otp, type = "reset") => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const subject =
      type === "reset"
        ? "Your Password Reset OTP"
        : "Welcome to ShipPro - Your Account Details";

    const message =
      type === "reset"
        ? `
      <h2>Password Reset Request</h2>
      <p>Your OTP code for password reset is:</p>
      <h3>${otp}</h3>
      <p>This OTP is valid for 10 minutes.</p>
      <p>Click below to login:</p>
      <a href="${process.env.LOGIN_URL}" target="_blank">${process.env.LOGIN_URL}</a>
      <p>If you did not request this, please ignore this email.</p>
      <p>Best regards,<br>ShipPro Team</p>
    `
        : `
      <h2>Welcome to ShipPro</h2>
      <p>Your account has been created successfully.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Temporary Password:</strong> ${otp}</p>
      <p>Please login and change your password immediately.</p>
      <p>Click below to login:</p>
      <a href="${process.env.LOGIN_URL}" target="_blank">${process.env.LOGIN_URL}</a>
      <p>Best regards,<br>ShipPro Team</p>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject,
      html: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${email} (${type})`);
  } catch (error) {
    console.error(`❌ Email sending failed:`, error);
  }
};

module.exports = sendOTPEmail;
