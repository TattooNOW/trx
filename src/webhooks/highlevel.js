const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Webhook: HighLevel contact created/updated
 * Use this to push data back to Lightspeed or trigger workflows.
 */
router.post('/contact', async (req, res) => {
  try {
    const { type, contact } = req.body;
    logger.info(`HighLevel webhook received: ${type} for contact ${contact?.id || 'unknown'}`);

    switch (type) {
      case 'ContactCreate':
        logger.info(`New HighLevel contact: ${contact.email || contact.phone}`);
        break;

      case 'ContactUpdate':
        logger.info(`Updated HighLevel contact: ${contact.id}`);
        break;

      case 'ContactTagUpdate':
        logger.info(`Tag update on HighLevel contact: ${contact.id}`);
        break;

      default:
        logger.debug(`Unhandled HighLevel event type: ${type}`);
    }

    res.json({ status: 'received' });
  } catch (error) {
    logger.error(`HighLevel webhook error: ${error.message}`);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * Webhook: HighLevel opportunity stage change
 */
router.post('/opportunity', async (req, res) => {
  try {
    const { type, opportunity } = req.body;
    logger.info(`HighLevel opportunity webhook: ${type} — ${opportunity?.id || 'unknown'}`);

    res.json({ status: 'received' });
  } catch (error) {
    logger.error(`HighLevel opportunity webhook error: ${error.message}`);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
