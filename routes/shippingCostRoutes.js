const express = require('express');
const router = express.Router();
const shippingCostController = require('../controllers/shippingCostController');
const authentication = require('./../middleware/authentication');

router.use(authentication.protect);
router.use(authentication.restrictTo('admin', 'client'));
router.post('/CalculateshippingCost', shippingCostController.CalculateshippingCost);

module.exports = router;