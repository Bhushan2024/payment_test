const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authentication = require('./../middleware/authentication');

router.use(authentication.protect);
router.use(authentication.restrictTo('admin', 'client'));
router.get('/getWalletBalance', walletController.getWalletBalance);



module.exports = router;