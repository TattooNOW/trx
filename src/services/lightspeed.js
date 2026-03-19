const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class LightspeedClient {
  constructor() {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.baseUrl = `${config.lightspeed.apiUrl}/Account/${config.lightspeed.accountId}`;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use(async (reqConfig) => {
      const token = await this.getAccessToken();
      reqConfig.headers.Authorization = `Bearer ${token}`;
      return reqConfig;
    });

    // Handle rate limiting (Lightspeed uses bucket-based rate limits)
    this.client.interceptors.response.use(null, async (error) => {
      if (error.response && error.response.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after'], 10) || 5;
        logger.warn(`Lightspeed rate limited, retrying after ${retryAfter}s`);
        await this._sleep(retryAfter * 1000);
        return this.client.request(error.config);
      }
      throw error;
    });
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    logger.info('Refreshing Lightspeed access token');
    const response = await axios.post('https://cloud.lightspeedapp.com/oauth/access_token.php', {
      client_id: config.lightspeed.clientId,
      client_secret: config.lightspeed.clientSecret,
      refresh_token: config.lightspeed.refreshToken,
      grant_type: 'refresh_token',
    });

    this.accessToken = response.data.access_token;
    // Expire 5 minutes early to avoid edge cases
    this.tokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000;
    return this.accessToken;
  }

  // --- Customers ---

  async getCustomers(params = {}) {
    const response = await this.client.get('/Customer.json', { params });
    const data = response.data.Customer;
    return Array.isArray(data) ? data : data ? [data] : [];
  }

  async getCustomer(customerId) {
    const response = await this.client.get(`/Customer/${customerId}.json`);
    return response.data.Customer;
  }

  async getCustomersSince(timestamp) {
    return this.getCustomers({
      timeStamp: `>=${timestamp}`,
      orderby: 'timeStamp',
      orderby_desc: 1,
    });
  }

  // --- Sales / Transactions ---

  async getSales(params = {}) {
    const response = await this.client.get('/Sale.json', {
      params: { load_relations: '["SaleLines","Customer"]', ...params },
    });
    const data = response.data.Sale;
    return Array.isArray(data) ? data : data ? [data] : [];
  }

  async getSale(saleId) {
    const response = await this.client.get(`/Sale/${saleId}.json`, {
      params: { load_relations: '["SaleLines","Customer"]' },
    });
    return response.data.Sale;
  }

  async getSalesSince(timestamp) {
    return this.getSales({
      timeStamp: `>=${timestamp}`,
      orderby: 'timeStamp',
      orderby_desc: 1,
    });
  }

  // --- Items / Products ---

  async getItems(params = {}) {
    const response = await this.client.get('/Item.json', { params });
    const data = response.data.Item;
    return Array.isArray(data) ? data : data ? [data] : [];
  }

  async getItem(itemId) {
    const response = await this.client.get(`/Item/${itemId}.json`);
    return response.data.Item;
  }

  // --- Employees ---

  async getEmployees(params = {}) {
    const response = await this.client.get('/Employee.json', { params });
    const data = response.data.Employee;
    return Array.isArray(data) ? data : data ? [data] : [];
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new LightspeedClient();
