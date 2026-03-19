const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const config = require('./config');
const logger = require('./utils/logger');
const apiRoutes = require('./routes/api');
const lightspeedWebhooks = require('./webhooks/lightspeed');
const highlevelWebhooks = require('./webhooks/highlevel');
const syncService = require('./services/sync');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);
app.use('/webhooks/lightspeed', lightspeedWebhooks);
app.use('/webhooks/highlevel', highlevelWebhooks);

// Root
app.get('/', (req, res) => {
  res.json({
    service: 'trx — Lightspeed ↔ HighLevel Integration',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      sync: 'POST /api/sync',
      syncCustomers: 'POST /api/sync/customers',
      syncTransactions: 'POST /api/sync/transactions',
      lightspeedCustomer: 'GET /api/lightspeed/customers/:id',
      highlevelContacts: 'GET /api/highlevel/contacts?email=...',
      webhookLightspeedSale: 'POST /webhooks/lightspeed/sale',
      webhookLightspeedCustomer: 'POST /webhooks/lightspeed/customer',
      webhookHighlevelContact: 'POST /webhooks/highlevel/contact',
      webhookHighlevelOpportunity: 'POST /webhooks/highlevel/opportunity',
    },
  });
});

// Scheduled sync
const cronExpression = `*/${config.sync.intervalMinutes} * * * *`;
cron.schedule(cronExpression, async () => {
  logger.info('Scheduled sync starting');
  try {
    await syncService.runFullSync();
  } catch (error) {
    logger.error(`Scheduled sync failed: ${error.message}`);
  }
});

// Start server
app.listen(config.port, () => {
  logger.info(`trx server running on port ${config.port}`);
  logger.info(`Sync scheduled every ${config.sync.intervalMinutes} minutes`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

module.exports = app;
