const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authentication = require('./../middleware/authentication');

router.use(authentication.protect);
router.use(authentication.restrictTo('admin', 'client'));
router.post('/create-payment-link', paymentController.createPaymentLink);
router.get('/callback', paymentController.verifyPayment);

module.exports = router;