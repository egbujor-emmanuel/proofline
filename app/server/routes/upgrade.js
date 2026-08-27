const express = require('express');
const subscriptionService = require('../services/subscriptionService');

const router = express.Router();

router.post('/', (req, res) => {
  const account = subscriptionService.upgradeToPro();
  res.json(account);
});

module.exports = router;
