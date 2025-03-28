const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const authentication = require('./../middleware/authentication');

router.use(authentication.protect);
router.use(authentication.restrictTo('admin', 'client'));
router.post('/createWarehouse', warehouseController.createWarehouse);
router.get('/getClientWarehouse', warehouseController.getUserWarehouses);
router.get('/getUniqueOrderId', warehouseController.generateUniqueOrderId);
router.post('/craeteForwardOrder', warehouseController.createForwardOrder);

router.post('/getshippingLabel', warehouseController.getshippingLabel);
router.post('/getshippingOrderDeatils', warehouseController.getshippingOrderDetails);
router.post('/getshippingOrdersbyUser', warehouseController.getshippingOrdersbyUser);
router.post('/editShipmentDetails', warehouseController.editShipmentDetails);



module.exports = router;