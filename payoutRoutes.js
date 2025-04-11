const express = require('express');
const router = express.Router();
const verifyToken = require('./middleware/verifyToken');
const { getPayouts } = require('./payoutController');

router.get('/', verifyToken, getPayouts);

module.exports = router;
