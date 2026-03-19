const express = require('express');
const syncService = require('../services/sync');
const lightspeed = require('../services/lightspeed');
const highlevel = require('../services/highlevel');
const logger = require('../utils/logger');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'trx',
    uptime: process.uptime(),
    lastSync: syncService.lastSyncTime,
  });
});

// Trigger a full sync manually
router.post('/sync', async (req, res) => {
  try {
    logger.info('Manual sync triggered via API');
    const results = await syncService.runFullSync();
    res.json({ status: 'complete', results });
  } catch (error) {
    logger.error(`Manual sync failed: ${error.message}`);
    res.status(500).json({ error: 'Sync failed', message: error.message });
  }
});

// Sync only customers
router.post('/sync/customers', async (req, res) => {
  try {
    const results = await syncService.syncCustomers();
    res.json({ status: 'complete', results });
  } catch (error) {
    logger.error(`Customer sync failed: ${error.message}`);
    res.status(500).json({ error: 'Customer sync failed', message: error.message });
  }
});

// Sync only transactions
router.post('/sync/transactions', async (req, res) => {
  try {
    const results = await syncService.syncTransactions();
    res.json({ status: 'complete', results });
  } catch (error) {
    logger.error(`Transaction sync failed: ${error.message}`);
    res.status(500).json({ error: 'Transaction sync failed', message: error.message });
  }
});

// Lookup a Lightspeed customer by ID
router.get('/lightspeed/customers/:id', async (req, res) => {
  try {
    const customer = await lightspeed.getCustomer(req.params.id);
    res.json(customer);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Search HighLevel contacts
router.get('/highlevel/contacts', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email query param required' });
    const contacts = await highlevel.searchContact(email);
    res.json(contacts);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

module.exports = router;
