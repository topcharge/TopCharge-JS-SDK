/* Universal (CommonJS, browser script, and bundler) TopCharge SDK. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TopChargeSDK = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_BASE_URL = "https://api.topcharge.app";

  class TopChargeApiError extends Error {
    constructor(message, status, responseBody) {
      super(message);
      this.name = "TopChargeApiError";
      this.status = status;
      this.responseBody = responseBody;
    }
  }

  class TopChargeClient {
    /**
     * @param {{clientId: string, secretKey?: string, baseUrl?: string, fetch?: typeof fetch}} options
     */
    constructor(options) {
      if (!options || typeof options.clientId !== "string" || options.clientId.trim() === "") {
        throw new TypeError("TopCharge clientId must not be empty.");
      }
      if (options.baseUrl !== undefined && (typeof options.baseUrl !== "string" || options.baseUrl.trim() === "")) {
        throw new TypeError("TopCharge baseUrl must not be empty.");
      }

      this.clientId = options.clientId;
      this.secretKey = options.secretKey || null;
      this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
      this.fetch = options.fetch || (typeof globalThis !== "undefined" ? globalThis.fetch : undefined);
      if (typeof this.fetch !== "function") {
        throw new TypeError("A fetch implementation is required. Node.js 18+ and modern browsers provide fetch by default.");
      }

      this.account = new AccountService(this);
      this.payments = new PaymentService(this);
      this.withdrawals = new WithdrawalService(this);
      this.giftCards = new GiftCardService(this);
    }

    async request(method, path, payload, query, signal) {
      const url = this.buildUrl(path, query);
      const headers = {
        Accept: "application/json",
        "x-api-key": this.clientId
      };
      if (this.secretKey) headers["x-api-secret"] = this.secretKey;

      const init = { method, headers, signal };
      if (payload !== undefined && payload !== null) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(payload);
      }

      const response = await this.fetch(url, init);
      const body = await response.text();
      if (!response.ok) {
        throw new TopChargeApiError(errorMessage(body, response.status), response.status, body);
      }
      if (body === "") return undefined;
      try {
        return JSON.parse(body);
      } catch (error) {
        throw new TypeError("TopCharge returned an invalid JSON response.", { cause: error });
      }
    }

    buildUrl(path, query) {
      const url = `${this.baseUrl}/${String(path).replace(/^\/+|\/+$/g, "")}/`;
      if (!query) return url;

      const parameters = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") parameters.set(key, String(value));
      }
      const text = parameters.toString();
      return text ? `${url}?${text}` : url;
    }
  }

  class AccountService {
    constructor(client) { this.client = client; }
    async verifyCredentials(options = {}) {
      await this.client.request("GET", "/api/v1/account/verify-credentials", undefined, undefined, options.signal);
    }
    getBalance(options = {}) {
      return this.client.request("GET", "/api/v1/account/balance", undefined, undefined, options.signal);
    }
  }

  class PaymentService {
    constructor(client) { this.client = client; }
    create({ paymentAmount, description, redirectUrl, callbackUrl }, options = {}) {
      return this.client.request("POST", "/api/v1/payment/create", compact({ paymentAmount, description, redirectUrl, callbackUrl }), undefined, options.signal);
    }
    getStatus(paymentId, options = {}) {
      return this.client.request("GET", `/api/v1/payment/status/${encodeURIComponent(paymentId)}`, undefined, undefined, options.signal);
    }
    cancel(paymentId, options = {}) {
      return this.client.request("POST", `/api/v1/payment/cancel/${encodeURIComponent(paymentId)}`, undefined, undefined, options.signal);
    }
  }

  class WithdrawalService {
    constructor(client) { this.client = client; }
    create({ phoneNumberCountryCode, phoneNumber, amount }, options = {}) {
      return this.client.request("POST", "/api/v1/withdrawal/create", { phoneNumberCountryCode, phoneNumber, amount }, undefined, options.signal);
    }
  }

  class GiftCardService {
    constructor(client) { this.client = client; }
    issue({ amount, idempotencyKey, quantity, name }, options = {}) {
      return this.client.request("POST", "/api/v1/giftcard/issue", compact({ amount, idempotencyKey, quantity, name }), undefined, options.signal);
    }
    listBatches(query = {}, options = {}) {
      return this.client.request("GET", "/api/v1/giftcard/batch", undefined, pagination(query), options.signal);
    }
    getBatch(batchId, options = {}) {
      return this.client.request("GET", `/api/v1/giftcard/batch/${encodeURIComponent(batchId)}`, undefined, undefined, options.signal);
    }
    listBatchCards(batchId, query = {}, options = {}) {
      return this.client.request("GET", `/api/v1/giftcard/batch/${encodeURIComponent(batchId)}/cards`, undefined, compact({ ...pagination(query), reveal: query.reveal || undefined }), options.signal);
    }
    revokeBatch(batchId, { reason } = {}, options = {}) {
      return this.client.request("POST", `/api/v1/giftcard/batch/${encodeURIComponent(batchId)}/revoke`, compact({ reason }), undefined, options.signal);
    }
    listCards(query = {}, options = {}) {
      return this.client.request("GET", "/api/v1/giftcard/card", undefined, compact({ ...pagination(query), status: query.status, batchId: query.batchId, standalone: query.standalone, reveal: query.reveal || undefined }), options.signal);
    }
    getCard(cardId, { reveal = false } = {}, options = {}) {
      return this.client.request("GET", `/api/v1/giftcard/card/${encodeURIComponent(cardId)}`, undefined, reveal ? { reveal: true } : undefined, options.signal);
    }
    revokeCard(cardId, { reason } = {}, options = {}) {
      return this.client.request("POST", `/api/v1/giftcard/card/${encodeURIComponent(cardId)}/revoke`, compact({ reason }), undefined, options.signal);
    }
  }

  function compact(object) {
    return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== null));
  }

  function pagination({ cursor, limit, sort } = {}) {
    return compact({ cursor, limit, sort });
  }

  function errorMessage(body, status) {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed.message === "string") return parsed.message;
      if (parsed.err && typeof parsed.err.message === "string") return parsed.err.message;
    } catch (_) {
      // Use a consistent error for a non-JSON response.
    }
    return `TopCharge API request failed with HTTP status ${status}.`;
  }

  return { TopChargeClient, TopChargeApiError, DEFAULT_BASE_URL };
});
