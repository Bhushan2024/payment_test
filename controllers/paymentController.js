const Razorpay = require('razorpay');
const { query } = require('../pgadmin');
const crypto = require('crypto');
const authentication = require("./../middleware/authentication");

// Create Razorpay controller
const createPaymentLink = async (req, res) => {
  try {
    // Get amount from request body
    const { amount } = req.body;
    
    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid amount'
      });
    }
    const authToken = req.headers.authorization?.split(" ")[1];
    const userId = authentication.decodeToken(authToken);
        if (!userId) {
            return res.status(401).json({ message: "Invalid authorization token" });
        }
        
    // Get the wallet_id for this user
    const walletResult = await query(
      'SELECT id FROM wallets WHERE user_id = $1',
      [userId]
    );
    
    if (walletResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found for this user'
      });
    }
    
    const walletId = walletResult.rows[0].id;
    
    // Generate a unique transaction ID
    const transactionId = `rzp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    
    // Initialize Razorpay instance with your credentials
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    const nowUtc = new Date();
    // First create a pending entry in the wallet_recharge table
    await query(
      'INSERT INTO wallet_recharge (wallet_id, transaction_type, amount, description, transaction_id, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [walletId, 'credit', amount, 'Wallet recharge via Razorpay', transactionId, 'pending', nowUtc]
    );
    
    // Create payment link options
    const options = {
      amount: amount * 100, // Razorpay expects amount in smallest currency unit (paise)
      currency: 'INR',
      accept_partial: false,
      description: 'Wallet recharge',
      customer: {
        name: req.body.name || 'Bhushan',
        email: req.body.email || 'Bhushan@gmail.com.com',
        contact: req.body.contact || '+919975359779'
      },
      notify: {
        sms: true,
        email: true
      },
      reminder_enable: true,
      notes: {
        wallet_id: walletId,
        transaction_id: transactionId,
        user_id: userId
      },
      callback_url: `https://payment-test-3vsv.onrender.com/api/v1/recharge/callback?transaction_id=${transactionId}`,
      callback_method: 'get'
    };
    
    // Create payment link
    const paymentLink = await razorpay.paymentLink.create(options);
    
    // Return success response with payment link
    return res.status(200).json({
      success: true,
      message: 'Payment link generated successfully',
      data: {
        payment_link: paymentLink.short_url,
        transaction_id: transactionId
      }
    });
    
  } catch (error) {
    console.error('Error creating payment link:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment link',
      error: error.message
    });
  }
};


const verifyPayment = async (req, res) => {
  try {
    const { 
      razorpay_payment_id, 
      razorpay_payment_link_id, 
      razorpay_payment_link_reference_id, 
      razorpay_payment_link_status, 
      razorpay_signature, 
      transaction_id 
    } = req.query;
    
    // If status is explicitly "paid", mark it as completed
    if (razorpay_payment_link_status === 'paid') {
      await query(
        'UPDATE wallet_recharge SET status = $1 WHERE transaction_id = $2',
        ['completed', transaction_id]
      );

      return res.redirect(`${process.env.FRONTEND_URL}/payment/success?transaction_id=${transaction_id}`);
    }

    // If status is missing or any other value, treat it as a failure
    await query(
      'UPDATE wallet_recharge SET status = $1 WHERE transaction_id = $2',
      ['failed', transaction_id]
    );

    return res.redirect(`${process.env.FRONTEND_URL}/payment/failure?transaction_id=${transaction_id}`);
    
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};


// Export the controller
module.exports = {
  createPaymentLink,
  verifyPayment
};