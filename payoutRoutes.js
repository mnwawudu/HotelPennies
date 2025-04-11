const express = require('express');
const router = express.Router();
const verifyToken = require('./verifyToken');
const { getPayouts } = require('./payoutController');

router.get('/', verifyToken, getPayouts);

module.exports = router;
