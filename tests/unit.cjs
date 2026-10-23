const assert = require("node:assert/strict");
const { TopChargeClient, TopChargeApiError } = require("../src/topcharge.js");

const calls = [];
const responses = [
  { status: 200, body: '{"availableBalance":"140000.0000"}' },
  { status: 201, body: '{"paymentId":"pay_123","paymentUrl":"https://checkout.example/pay_123"}' },
  { status: 401, body: '{"ok":false,"err":{"message":"invalid API credentials"}}' }
];

const fakeFetch = async (url, init) => {
  calls.push({ url, init });
  const next = responses.shift();
  return { ok: next.status >= 200 && next.status < 300, status: next.status, text: async () => next.body };
};

(async () => {
  const client = new TopChargeClient({ clientId: "mch_test_example", secretKey: "sk_test_example", baseUrl: "https://api.example.test/", fetch: fakeFetch });
  const balance = await client.account.getBalance();
  assert.equal(balance.availableBalance, "140000.0000");

  const payment = await client.payments.create({ paymentAmount: "25000", description: "Invoice #1001" });
  assert.equal(payment.paymentId, "pay_123");
  assert.equal(calls[0].url, "https://api.example.test/api/v1/account/balance/");
  assert.equal(calls[0].init.headers["x-api-key"], "mch_test_example");
  assert.equal(calls[0].init.headers["x-api-secret"], "sk_test_example");
  assert.equal(calls[1].init.body, '{"paymentAmount":"25000","description":"Invoice #1001"}');

  await assert.rejects(() => client.account.verifyCredentials(), (error) => {
    assert(error instanceof TopChargeApiError);
    assert.equal(error.status, 401);
    assert.equal(error.message, "invalid API credentials");
    return true;
  });

  console.log("All JavaScript SDK tests passed.");
})();
