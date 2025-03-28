const nodemailer = require("nodemailer");
require("dotenv").config(); 

// Function to send email
const sendAddClientMail = async (userEmail, userName, generatedPassword) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Define email content
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: userEmail,
      subject: "Welcome to ShipPro - Your account has been created successfully",
      html: `
        <h4>Hello ${userName},</h4>
        <p>Congratulations! Your account has been successfully created on ShipPro.</p>
        <p>You can log in using the following credentials:</p>
        <ul>
          <li><strong>Email:</strong> ${userEmail}</li>
          <li><strong>Password:</strong> ${generatedPassword}</li>
        </ul>
        <p><a href="${process.env.LOGIN_URL}" target="_blank">Click here to log in</a></p>
        <p>Best regards,<br/>Admin, ShipPro Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${userEmail}`);
  } catch (error) {
    console.error(`❌ Email sending failed:`, error);
  }
};

module.exports = sendAddClientMail;
