const path = require('path');
const express = require('express');

const accountRoute = require('./routes/account');
const upgradeRoute = require('./routes/upgrade');
const resetRoute = require('./routes/reset');
const proFeatureRoute = require('./routes/proFeature');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/account', accountRoute);
app.use('/api/upgrade', upgradeRoute);
app.use('/api/reset', resetRoute);
app.use('/api/pro-feature', proFeatureRoute);

app.listen(PORT, () => {
  console.log(`Subscription dashboard running at http://localhost:${PORT}`);
});
