const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authController = require('./../controllers/authController');
const authentication = require('./../middleware/authentication');


router.post('/login', authController.login);
router.post('/forgetPassword', authController.forgetPassword);
router.post('/verifyOTPandResetPassword', authController.verifyOTP);
router.post('/updatePassword', authController.updatePassword);


// Protect all routes after this middleware
router.use(authentication.protect);

// Only admin have permission to access for the below APIs 
router.use(authentication.restrictTo('admin'));
router.post('/addClient', authController.signup);
router.get('/getClient', userController.getAllClients);
router.post('/deactivateClient', userController.deactivateClient);
router.post('/activateClient', userController.activateClient);
router.post('/permanentDeleteClient', userController.deleteClient);









module.exports = router;