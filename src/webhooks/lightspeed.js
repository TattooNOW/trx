const express = require('express');
const highlevel = require('../services/highlevel');
const lightspeed = require('../services/lightspeed');
const syncService = require('../services/sync');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Webhook: Lightspeed Sale completed
 * Triggered when a sale is completed in Lightspeed POS.
 * Syncs the customer and transaction to HighLevel in real time.
 */
router.post('/sale', async (req, res) => {
  try {
    const { saleID } = req.body;
    if (!saleID) {
      return res.status(400).json({ error: 'Missing saleID' });
    }

    logger.info(`Webhook received: Lightspeed sale ${saleID}`);

    const sale = await lightspeed.getSale(saleID);
    if (!sale || !sale.Customer) {
      logger.warn(`Sale ${saleID} has no customer, skipping`);
      return res.json({ status: 'skipped', reason: 'no customer' });
    }

    const contactData = syncService.mapLightspeedCustomerToContact(sale.Customer);
    if (!contactData.email && !contactData.phone) {
      return res.json({ status: 'skipped', reason: 'no contact info' });
    }

    const contact = await highlevel.upsertContact(contactData);

    const total = parseFloat(sale.calcTotal) || 0;
    const tags = ['has-purchase'];
    if (total >= 500) tags.push('high-value-customer');
    if (total >= 1000) tags.push('vip-customer');
    await highlevel.addContactTag(contact.id, tags);

    await highlevel.addContactNote(
      contact.id,
      `Lightspeed Sale #${saleID} — $${sale.calcTotal} on ${sale.completeTime || sale.createTime}`
    );

    logger.info(`Webhook processed: sale ${saleID} → contact ${contact.id}`);
    res.json({ status: 'synced', contactId: contact.id });
  } catch (error) {
    logger.error(`Webhook error (sale): ${error.message}`);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * Webhook: Lightspeed Customer created/updated
 */
router.post('/customer', async (req, res) => {
  try {
    const { customerID } = req.body;
    if (!customerID) {
      return res.status(400).json({ error: 'Missing customerID' });
    }

    logger.info(`Webhook received: Lightspeed customer ${customerID}`);

    const customer = await lightspeed.getCustomer(customerID);
    const contactData = syncService.mapLightspeedCustomerToContact(customer);

    if (!contactData.email && !contactData.phone) {
      return res.json({ status: 'skipped', reason: 'no contact info' });
    }

    const contact = await highlevel.upsertContact(contactData);
    logger.info(`Webhook processed: customer ${customerID} → contact ${contact.id}`);
    res.json({ status: 'synced', contactId: contact.id });
  } catch (error) {
    logger.error(`Webhook error (customer): ${error.message}`);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
