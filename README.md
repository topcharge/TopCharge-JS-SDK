# TopCharge JavaScript SDK

Universal, dependency-free JavaScript SDK for Node.js backends and browser bundlers (React, Next.js, Vue, Nuxt, Angular, Svelte, and similar frameworks). It supports ESM, CommonJS, and a browser-script global.

## Security: keep merchant credentials on the server

`mch_...` and `sk_...` credentials grant merchant API access. Do **not** put either value in browser code, `NEXT_PUBLIC_*` variables, Vite variables, or any client-side bundle. Use this SDK in your server, API route, server action, or serverless function; the frontend should call your own backend endpoint.

## Release status

This package is publicly available on npm as [`@topcharge-app/sdk` 1.0.0](https://www.npmjs.com/package/@topcharge-app/sdk).

## Install locally

```bash
npm install @topcharge-app/sdk
```

## Node.js, Express, Next.js API routes, and server actions

```js
import { TopChargeClient } from "@topcharge-app/sdk";

const topcharge = new TopChargeClient({
  clientId: process.env.TOPCHARGE_CLIENT_ID,
  secretKey: process.env.TOPCHARGE_SECRET_KEY
});

const payment = await topcharge.payments.create({
  paymentAmount: "25000",
  description: "Invoice #1001",
  redirectUrl: "https://merchant.example/success",
  callbackUrl: "https://merchant.example/webhooks/payment"
});

console.log(payment.paymentUrl);
```

CommonJS works too:

```js
const { TopChargeClient } = require("@topcharge-app/sdk");
```

## Frontend pattern

Call your own server endpoint from the browser, then redirect using the URL returned by your server:

```js
// React, Vue, Angular, Svelte, or plain browser JavaScript
const response = await fetch("/api/payments", { method: "POST" });
const { paymentUrl } = await response.json();
window.location.assign(paymentUrl);
```

The API route behind `/api/payments` uses the server-side example above. This pattern works for every frontend framework without exposing credentials.

## Services

```js
await topcharge.account.verifyCredentials();
const balance = await topcharge.account.getBalance();

const payment = await topcharge.payments.create({ paymentAmount: "25000" });
const status = await topcharge.payments.getStatus(payment.paymentId);
await topcharge.payments.cancel(payment.paymentId);

await topcharge.withdrawals.create({
  phoneNumberCountryCode: "964",
  phoneNumber: "7701234567",
  amount: "50000"
});

```

All responses are ordinary JavaScript objects. Failed API calls throw `TopChargeApiError`, which includes `status` and `responseBody`. Every method accepts an optional `{ signal }` final argument for cancellation with `AbortController`.

## Tests and individual integration examples

```bash
npm test
node tests/integration.cjs help
```

For a live payment-link smoke test (create → status → cancel):

```bash
export TOPCHARGE_RUN_INTEGRATION=1
export TOPCHARGE_CLIENT_ID='mch_...'
export TOPCHARGE_SECRET_KEY='sk_...'
node tests/integration.cjs payment:smoke
```

Each API operation is also separate: `payment:create`, `payment:status`, `payment:cancel`, `account:balance`, and `withdrawal:create`. Run `node tests/integration.cjs help` for inputs. Value-moving operations require an additional `TOPCHARGE_ALLOW_*` confirmation variable.

## Reliability

The SDK does not retry requests automatically. Reads can generally be retried; do not blindly retry payment creation or withdrawals after an unknown result. Use `AbortController` to bound a request in Node.js or serverless runtimes.

## License

[MIT License](LICENSE)

## Source

[github.com/topcharge/TopCharge-JS-SDK](https://github.com/topcharge/TopCharge-JS-SDK)
