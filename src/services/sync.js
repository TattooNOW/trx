const lightspeed = require('./lightspeed');
const highlevel = require('./highlevel');
const logger = require('../utils/logger');

class SyncService {
  constructor() {
    this.lastSyncTime = null;
  }

  // --- Customer Sync: Lightspeed → HighLevel ---

  mapLightspeedCustomerToContact(customer) {
    const contact = {
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.Contact && customer.Contact.Emails
        ? this._extractEmail(customer.Contact.Emails)
        : '',
      phone: customer.Contact && customer.Contact.Phones
        ? this._extractPhone(customer.Contact.Phones)
        : '',
      tags: ['lightspeed-customer'],
      customFields: [
        { key: 'lightspeed_customer_id', field_value: String(customer.customerID) },
        { key: 'lightspeed_customer_type', field_value: customer.customerTypeID || '' },
      ],
    };

    if (customer.Contact && customer.Contact.Addresses) {
      const addr = this._extractAddress(customer.Contact.Addresses);
      if (addr) {
        contact.address1 = addr.address1 || '';
        contact.city = addr.city || '';
        contact.state = addr.state || '';
        contact.postalCode = addr.zip || '';
        contact.country = addr.country || '';
      }
    }

    return contact;
  }

  async syncCustomers() {
    logger.info('Starting customer sync: Lightspeed → HighLevel');
    const params = this.lastSyncTime
      ? { timeStamp: `>=${this.lastSyncTime}` }
      : {};

    const customers = await lightspeed.getCustomers(params);
    logger.info(`Found ${customers.length} customers to sync`);

    const results = { created: 0, updated: 0, errors: 0 };

    for (const customer of customers) {
      try {
        const contactData = this.mapLightspeedCustomerToContact(customer);
        if (!contactData.email && !contactData.phone) {
          logger.debug(`Skipping customer ${customer.customerID} — no email or phone`);
          continue;
        }
        await highlevel.upsertContact(contactData);
        results.created++;
      } catch (error) {
        logger.error(`Failed to sync customer ${customer.customerID}: ${error.message}`);
        results.errors++;
      }
    }

    logger.info(`Customer sync complete: ${JSON.stringify(results)}`);
    return results;
  }

  // --- Transaction Sync: Lightspeed → HighLevel ---

  async syncTransactions() {
    logger.info('Starting transaction sync: Lightspeed → HighLevel');
    const params = this.lastSyncTime
      ? { timeStamp: `>=${this.lastSyncTime}`, completed: true }
      : { completed: true };

    const sales = await lightspeed.getSales(params);
    logger.info(`Found ${sales.length} completed sales to sync`);

    const results = { synced: 0, skipped: 0, errors: 0 };

    for (const sale of sales) {
      try {
        if (!sale.Customer) {
          logger.debug(`Skipping sale ${sale.saleID} — no customer attached`);
          results.skipped++;
          continue;
        }

        const contactData = this.mapLightspeedCustomerToContact(sale.Customer);
        if (!contactData.email && !contactData.phone) {
          results.skipped++;
          continue;
        }

        const contact = await highlevel.upsertContact(contactData);

        // Add transaction note
        const saleLines = sale.SaleLines && sale.SaleLines.SaleLine
          ? (Array.isArray(sale.SaleLines.SaleLine)
            ? sale.SaleLines.SaleLine
            : [sale.SaleLines.SaleLine])
          : [];

        const lineItems = saleLines.map((line) =>
          `${line.Item ? line.Item.description : 'Unknown'} x${line.unitQuantity} — $${line.calcTotal}`
        ).join('\n');

        const noteBody = [
          `💰 Lightspeed Sale #${sale.saleID}`,
          `Date: ${sale.completeTime || sale.createTime}`,
          `Total: $${sale.calcTotal}`,
          `Payment: ${sale.completed ? 'Completed' : 'Pending'}`,
          '',
          'Items:',
          lineItems || 'No line items',
        ].join('\n');

        await highlevel.addContactNote(contact.id, noteBody);

        // Tag based on transaction value
        const total = parseFloat(sale.calcTotal) || 0;
        const tags = ['has-purchase'];
        if (total >= 500) tags.push('high-value-customer');
        if (total >= 1000) tags.push('vip-customer');
        await highlevel.addContactTag(contact.id, tags);

        results.synced++;
      } catch (error) {
        logger.error(`Failed to sync sale ${sale.saleID}: ${error.message}`);
        results.errors++;
      }
    }

    logger.info(`Transaction sync complete: ${JSON.stringify(results)}`);
    return results;
  }

  // --- Full Sync ---

  async runFullSync() {
    logger.info('=== Starting full sync ===');
    const startTime = new Date().toISOString();

    const customerResults = await this.syncCustomers();
    const transactionResults = await this.syncTransactions();

    this.lastSyncTime = startTime;

    const summary = { customers: customerResults, transactions: transactionResults };
    logger.info(`=== Full sync complete: ${JSON.stringify(summary)} ===`);
    return summary;
  }

  // --- Helpers ---

  _extractEmail(emails) {
    if (typeof emails === 'string') return emails;
    if (emails.ContactEmail) {
      const list = Array.isArray(emails.ContactEmail) ? emails.ContactEmail : [emails.ContactEmail];
      return list[0]?.address || '';
    }
    return '';
  }

  _extractPhone(phones) {
    if (typeof phones === 'string') return phones;
    if (phones.ContactPhone) {
      const list = Array.isArray(phones.ContactPhone) ? phones.ContactPhone : [phones.ContactPhone];
      return list[0]?.number || '';
    }
    return '';
  }

  _extractAddress(addresses) {
    if (addresses.ContactAddress) {
      const list = Array.isArray(addresses.ContactAddress) ? addresses.ContactAddress : [addresses.ContactAddress];
      return list[0] || null;
    }
    return null;
  }
}

module.exports = new SyncService();
