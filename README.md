# GPay Node.js SDK

A Node.js SDK for interacting with the GPay API.

**Official API Documentation:** [https://gpay.ly/banking/doc/index.html](https://gpay.ly/banking/doc/index.html)

## Installation

```
npm install gpay-nodejs-sdk
# or
yarn add gpay-nodejs-sdk
```

## Usage

### Import and Initialize

```js
import GPayApiClient, { BaseUrl } from 'gpay-nodejs-sdk';

const client = new GPayApiClient(
  'your_api_key',
  'your_secret_key',
  'your_password',
  BaseUrl.PRODUCTION // or BaseUrl.STAGING
);
```

### Get Wallet Balance
```js
// Returns: Balance object
// Async/await style
const balance = await client.getBalance();
console.log(balance);

// Promise style
client.getBalance().then(balance => {
  console.log(balance);
});
```

### Create Payment Request
```js
// Returns: PaymentRequest object
// Async/await style
const paymentRequest = await client.createPaymentRequest('100', 'REF123', 'Payment for order');
console.log(paymentRequest);

// Promise style
client.createPaymentRequest('100', 'REF123', 'Payment for order').then(paymentRequest => {
  console.log(paymentRequest);
});
```

### Check Payment Status
```js
// Returns: PaymentStatus object
// Async/await style
const status = await client.checkPaymentStatus('request_id_here');
console.log(status);

// Promise style
client.checkPaymentStatus('request_id_here').then(status => {
  console.log(status);
});
```

### Send Money
```js
// Returns: SendMoneyResult object
// Async/await style
const result = await client.sendMoney('50', 'recipient_wallet_id', 'REF456', 'Send money');
console.log(result);

// Promise style
client.sendMoney('50', 'recipient_wallet_id', 'REF456', 'Send money').then(result => {
  console.log(result);
});
```

### Get Statement
```js
// Returns: Statement object
// Async/await style
const statement = await client.getStatement('2025-06-22');
console.log(statement);

// Iterate over transactions in the statement
for (const tx of statement.dayStatement) {
  console.log(tx); // Each tx is a StatementTransaction object
}

// Promise style
client.getStatement('2025-06-22').then(statement => {
  console.log(statement);
  // Iterate over transactions
  statement.dayStatement.forEach(tx => {
    console.log(tx);
  });
});
```

### Check Wallet
```js
// Returns: WalletCheck object
// Async/await style
const walletInfo = await client.checkWallet('wallet_gateway_id');
console.log(walletInfo);

// Promise style
client.checkWallet('wallet_gateway_id').then(walletInfo => {
  console.log(walletInfo);
});
```

### Get Outstanding Transactions
```js
// Returns: OutstandingTransactions object
// Async/await style
const outstanding = await client.getOutstandingTransactions();
console.log(outstanding);

// Iterate over outstanding transactions
for (const tx of outstanding.outstandingTransactions) {
  console.log(tx); // Each tx is an OutstandingTransaction object
}

// Promise style
client.getOutstandingTransactions().then(outstanding => {
  console.log(outstanding);
  // Iterate over transactions
  outstanding.outstandingTransactions.forEach(tx => {
    console.log(tx);
  });
});
```

## Constants

You can also access the following constants:
- `BaseUrl` (for environment selection)
- `OperationType` (operation type enums)
- `TransactionStatus` (transaction status enums)

## License

MIT
