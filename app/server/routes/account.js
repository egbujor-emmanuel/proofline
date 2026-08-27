const express = require('express');
const subscriptionService = require('../services/subscriptionService');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(subscriptionService.getAccount());
});

module.exports = router;
