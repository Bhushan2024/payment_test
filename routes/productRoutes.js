const express = require('express');
const router = express.Router();
const productController = require('../controllers/prodcutController');
const authentication = require('./../middleware/authentication');

router.use(authentication.protect);
//router.use(authentication.restrictTo('client', 'admin'));
//Category Routes
router.post('/createCategory', productController.createCategory);
router.get('/getCategoriesForCurrentUser', productController.getCategoriesByUserId );
router.post('/getCategoryById', productController.getCategoryById);
router.post('/updateCategory', productController.updateCategory);
router.post('/deleteCategory', productController.deleteCategory);

//Product Routes
router.post('/createProduct', productController.createProduct);
router.post('/getProductsByCategory', productController.getProductsByCategory );
router.post('/getProductById', productController.getProductById);
router.post('/updateProduct', productController.updateProduct);
router.post('/deleteProduct', productController.deleteProduct);
router.post('/getProductsByUserId', productController.getProductsByUserId);

router.use(authentication.restrictTo('admin'));
router.get('/getAllCategoriesForCurrentUser', productController.getAllCategories );
router.get('/getAllProducts', productController.getAllProducts );

module.exports = router;