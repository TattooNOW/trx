const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class HighLevelClient {
  constructor() {
    this.client = axios.create({
      baseURL: config.highlevel.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.highlevel.apiKey}`,
        Version: '2021-07-28',
      },
    });

    this.client.interceptors.response.use(null, async (error) => {
      if (error.response && error.response.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after'], 10) || 5;
        logger.warn(`HighLevel rate limited, retrying after ${retryAfter}s`);
        await this._sleep(retryAfter * 1000);
        return this.client.request(error.config);
      }
      throw error;
    });
  }

  // --- Contacts ---

  async searchContact(email) {
    const response = await this.client.get('/contacts/', {
      params: {
        locationId: config.highlevel.locationId,
        query: email,
      },
    });
    return response.data.contacts || [];
  }

  async getContact(contactId) {
    const response = await this.client.get(`/contacts/${contactId}`);
    return response.data.contact;
  }

  async createContact(contactData) {
    const response = await this.client.post('/contacts/', {
      locationId: config.highlevel.locationId,
      ...contactData,
    });
    logger.info(`Created HighLevel contact: ${response.data.contact.id}`);
    return response.data.contact;
  }

  async updateContact(contactId, contactData) {
    const response = await this.client.put(`/contacts/${contactId}`, contactData);
    logger.info(`Updated HighLevel contact: ${contactId}`);
    return response.data.contact;
  }

  async upsertContact(contactData) {
    if (contactData.email) {
      const existing = await this.searchContact(contactData.email);
      if (existing.length > 0) {
        return this.updateContact(existing[0].id, contactData);
      }
    }
    return this.createContact(contactData);
  }

  // --- Tags ---

  async addContactTag(contactId, tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    const response = await this.client.post(`/contacts/${contactId}/tags`, {
      tags: tagArray,
    });
    logger.info(`Added tags [${tagArray.join(', ')}] to contact ${contactId}`);
    return response.data;
  }

  async removeContactTag(contactId, tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    const response = await this.client.delete(`/contacts/${contactId}/tags`, {
      data: { tags: tagArray },
    });
    return response.data;
  }

  // --- Notes ---

  async addContactNote(contactId, body) {
    const response = await this.client.post(`/contacts/${contactId}/notes`, {
      body,
    });
    logger.info(`Added note to contact ${contactId}`);
    return response.data;
  }

  // --- Opportunities (Pipeline Deals) ---

  async createOpportunity(opportunityData) {
    const response = await this.client.post('/opportunities/', opportunityData);
    logger.info(`Created opportunity: ${response.data.opportunity.id}`);
    return response.data.opportunity;
  }

  async updateOpportunity(opportunityId, data) {
    const response = await this.client.put(`/opportunities/${opportunityId}`, data);
    return response.data.opportunity;
  }

  async searchOpportunities(params = {}) {
    const response = await this.client.get('/opportunities/search', {
      params: { location_id: config.highlevel.locationId, ...params },
    });
    return response.data.opportunities || [];
  }

  // --- Custom Fields / Values ---

  async updateContactCustomField(contactId, customFields) {
    return this.updateContact(contactId, { customFields });
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new HighLevelClient();
