const express = require('express');
const subscriptionService = require('../services/subscriptionService');

const router = express.Router();

router.get('/', (req, res) => {
  if (!subscriptionService.isPro()) {
    return res.status(403).json({ error: 'Pro plan required' });
  }
  res.json(subscriptionService.getProFeatureContent());
});

module.exports = router;
