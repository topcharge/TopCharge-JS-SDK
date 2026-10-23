const { TopChargeClient, TopChargeApiError } = require("../src/topcharge.js");

const action = process.argv[2] || "help";
if (action === "help") {
  printHelp();
  process.exit(0);
}
if (process.env.TOPCHARGE_RUN_INTEGRATION !== "1") fail("Refusing to call the API. Set TOPCHARGE_RUN_INTEGRATION=1.");

const client = new TopChargeClient({
  clientId: required("TOPCHARGE_CLIENT_ID"),
  secretKey: required("TOPCHARGE_SECRET_KEY"),
  baseUrl: process.env.TOPCHARGE_BASE_URL || "https://api.topcharge.app"
});

run().catch((error) => {
  if (error instanceof TopChargeApiError) fail(`TopCharge API error (${error.status}): ${error.message}`);
  fail(error.message || String(error));
});

async function run() {
  switch (action) {
    case "account:verify": await client.account.verifyCredentials(); console.log("Credentials are valid."); return;
    case "account:balance": return print(await client.account.getBalance());
    case "payment:create": return print(await client.payments.create(paymentPayload("manual test")));
    case "payment:status": return print(await client.payments.getStatus(required("TOPCHARGE_PAYMENT_ID")));
    case "payment:cancel": return print(await client.payments.cancel(required("TOPCHARGE_PAYMENT_ID")));
    case "payment:smoke": return paymentSmoke();
    case "withdrawal:create":
      confirmation("TOPCHARGE_ALLOW_MONEY_MOVEMENT");
      return print(await client.withdrawals.create({ phoneNumberCountryCode: required("TOPCHARGE_PHONE_COUNTRY_CODE"), phoneNumber: required("TOPCHARGE_PHONE_NUMBER"), amount: required("TOPCHARGE_WITHDRAWAL_AMOUNT") }));
    case "giftcard:issue":
      confirmation("TOPCHARGE_ALLOW_VALUE_ISSUANCE");
      return print(await client.giftCards.issue({ amount: required("TOPCHARGE_GIFTCARD_AMOUNT"), idempotencyKey: required("TOPCHARGE_IDEMPOTENCY_KEY"), quantity: positiveInt("TOPCHARGE_GIFTCARD_QUANTITY"), name: process.env.TOPCHARGE_GIFTCARD_NAME }));
    case "giftcard:batches": return print(await client.giftCards.listBatches(pagination()));
    case "giftcard:batch": return print(await client.giftCards.getBatch(required("TOPCHARGE_BATCH_ID")));
    case "giftcard:batch-cards": return print(await client.giftCards.listBatchCards(required("TOPCHARGE_BATCH_ID"), { ...pagination(), reveal: boolean("TOPCHARGE_REVEAL") }));
    case "giftcard:revoke-batch":
      confirmation("TOPCHARGE_ALLOW_VALUE_REVOCATION");
      return print(await client.giftCards.revokeBatch(required("TOPCHARGE_BATCH_ID"), { reason: process.env.TOPCHARGE_REVOKE_REASON }));
    case "giftcard:cards": return print(await client.giftCards.listCards({ ...pagination(), status: process.env.TOPCHARGE_GIFTCARD_STATUS, batchId: process.env.TOPCHARGE_BATCH_ID, standalone: nullableBoolean("TOPCHARGE_STANDALONE"), reveal: boolean("TOPCHARGE_REVEAL") }));
    case "giftcard:card": return print(await client.giftCards.getCard(required("TOPCHARGE_CARD_ID"), { reveal: boolean("TOPCHARGE_REVEAL") }));
    case "giftcard:revoke-card":
      confirmation("TOPCHARGE_ALLOW_VALUE_REVOCATION");
      return print(await client.giftCards.revokeCard(required("TOPCHARGE_CARD_ID"), { reason: process.env.TOPCHARGE_REVOKE_REASON }));
    default: fail(`Unknown action '${action}'. Run: node tests/integration.cjs help`);
  }
}

async function paymentSmoke() {
  let paymentId;
  try {
    const payment = await client.payments.create(paymentPayload(`smoke ${Math.random().toString(16).slice(2)}`));
    paymentId = payment.paymentId;
    const status = await client.payments.getStatus(paymentId);
    if (status.paymentId !== paymentId) fail("Payment status response does not match the created payment.");
    console.log(`Payment link created and verified for payment ID: ${paymentId}`);
  } finally {
    if (paymentId) {
      print(await client.payments.cancel(paymentId));
      console.log("Test payment cancelled.");
    }
  }
}

function paymentPayload(label) {
  return {
    paymentAmount: process.env.TOPCHARGE_TEST_PAYMENT_AMOUNT || "50000",
    description: process.env.TOPCHARGE_PAYMENT_DESCRIPTION || `TopCharge JavaScript SDK ${label}`,
    redirectUrl: process.env.TOPCHARGE_REDIRECT_URL || "https://example.com/topcharge-sdk-test",
    callbackUrl: process.env.TOPCHARGE_CALLBACK_URL || "https://example.com/topcharge-sdk-webhook"
  };
}
function pagination() { return { cursor: process.env.TOPCHARGE_CURSOR, limit: positiveInt("TOPCHARGE_LIMIT"), sort: sort() }; }
function required(name) { return process.env[name] || fail(`${name} is required.`); }
function confirmation(name) { if (process.env[name] !== "1") fail(`This action changes money or value. Set ${name}=1 to continue.`); }
function positiveInt(name) { if (!process.env[name]) return undefined; const value = Number(process.env[name]); return Number.isInteger(value) && value > 0 ? value : fail(`${name} must be a positive integer.`); }
function sort() { const value = process.env.TOPCHARGE_SORT; return !value || value === "asc" || value === "desc" ? value : fail("TOPCHARGE_SORT must be asc or desc."); }
function boolean(name) { const value = process.env[name]; if (!value) return false; if (["1", "true", "yes"].includes(value.toLowerCase())) return true; if (["0", "false", "no"].includes(value.toLowerCase())) return false; fail(`${name} must be true or false.`); }
function nullableBoolean(name) { return process.env[name] ? boolean(name) : undefined; }
function print(value) { console.log(JSON.stringify(value, null, 2)); }
function fail(message) { throw new Error(message); }
function printHelp() { console.log(`TopCharge JavaScript integration examples

Set TOPCHARGE_RUN_INTEGRATION=1, TOPCHARGE_CLIENT_ID, and TOPCHARGE_SECRET_KEY first.

Account: account:verify | account:balance
Payment: payment:create | payment:status (TOPCHARGE_PAYMENT_ID) | payment:cancel (TOPCHARGE_PAYMENT_ID) | payment:smoke
Withdrawal: withdrawal:create (TOPCHARGE_ALLOW_MONEY_MOVEMENT=1 plus recipient variables)
Gift cards: giftcard:issue | giftcard:batches | giftcard:batch | giftcard:batch-cards | giftcard:cards | giftcard:card | giftcard:revoke-batch | giftcard:revoke-card

Run payment:smoke to create, verify, then cancel a test payment.`); }
