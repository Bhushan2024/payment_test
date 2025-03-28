const express = require('express');
const Razorpay = require('razorpay');
const { query } = require('../pgadmin');
const crypto = require('crypto');

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
    
    // Static user ID (as requested)
    const userId = 5;
    
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
    
    // First create a pending entry in the wallet_recharge table
    await query(
      'INSERT INTO wallet_recharge (wallet_id, transaction_type, amount, description, transaction_id, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [walletId, 'credit', amount, 'Wallet recharge via Razorpay', transactionId, 'pending']
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
      callback_url: `${process.env.CALLBACK_URL}/recharge/callback'}?transaction_id=${transactionId}`,
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
    const { razorpay_payment_id, razorpay_payment_link_id, razorpay_payment_link_reference_id, razorpay_payment_link_status, razorpay_signature, transaction_id } = req.query;
    
    // Verify payment status from Razorpay
    if (razorpay_payment_link_status === 'paid') {
      // Update the wallet_recharge status to completed
      await query(
        'UPDATE wallet_recharge SET status = $1 WHERE transaction_id = $2',
        ['completed', transaction_id]
      );
      
      // Additional business logic here (like updating user's wallet balance)
      // Get the amount from the wallet_recharge entry
      const rechargeResult = await query(
        'SELECT wallet_id, amount FROM wallet_recharge WHERE transaction_id = $1',
        [transaction_id]
      );
      
      if (rechargeResult.rows.length > 0) {
        const { wallet_id, amount } = rechargeResult.rows[0];
        
        // Update the wallet balance
        await query(
          'UPDATE wallets SET balance = balance + $1 WHERE id = $2',
          [amount, wallet_id]
        );
      }
      
      // Redirect to success page
      return res.redirect(`${process.env.FRONTEND_URL}/payment/success?transaction_id=${transaction_id}`);
    } else {
      // Update the wallet_recharge status to failed
      await query(
        'UPDATE wallet_recharge SET status = $1 WHERE transaction_id = $2',
        ['failed', transaction_id]
      );
      
      // Redirect to failure page
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failure?transaction_id=${transaction_id}`);
    }
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