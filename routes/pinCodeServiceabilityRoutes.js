const express = require('express');
const router = express.Router();
const { pinCodeServiceability, pinCodeData } = require('../controllers/pinCodeServiceabilityController');

router.post('/pinCodeServiceability', pinCodeServiceability);
router.post('/pinCodeData', pinCodeData);

module.exports = router;

