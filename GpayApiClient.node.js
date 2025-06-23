/*
 * Copyright (c) 2025 Libya Guide for Information Technology and Training
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import crypto from 'crypto';

/**
 * GPayApiClient provides a client for interacting with the GPay Payment API.
 * It handles authentication, request signing, and parsing of all supported endpoints.
 *
 * Usage:
 *   const client = new GPayApiClient(apiKey, secretKey, password, baseUrl);
 *   const balance = await client.getBalance();
 *
 * Constructor Parameters:
 *   @param {string} apiKey - The API key for authentication.
 *   @param {string} secretKey - The secret key for signing requests.
 *   @param {string} password - The password for hash token generation.
 *   @param {string} baseUrl - The base URL of the GPay API.
 *
 * Methods:
 *   async getBalance(): Promise<Balance>
 *     - Retrieves the current wallet balance.
 *
 *   async createPaymentRequest(amount, referenceNo, description): Promise<PaymentRequest>
 *     - Creates a payment request for a specified amount.
 *     - @param {number|string} amount - The amount to request.
 *     - @param {string} referenceNo - Optional reference number.
 *     - @param {string} description - Optional description.
 *
 *   async checkPaymentStatus(requestId): Promise<PaymentStatus>
 *     - Checks the status of a payment request by its request ID.
 *     - @param {string} requestId - The payment request ID.
 *
 *   async sendMoney(amount, walletGatewayId, referenceNo, description): Promise<SendMoneyResult>
 *     - Sends money to another wallet.
 *     - @param {number|string} amount - The amount to send.
 *     - @param {string} walletGatewayId - The recipient's wallet gateway ID.
 *     - @param {string} referenceNo - Optional reference number.
 *     - @param {string} description - Optional description.
 *
 *   async getStatement(date): Promise<Statement>
 *     - Retrieves the wallet's transaction statement for a specific day.
 *     - @param {string} date - The date in YYYY-MM-DD format.
 *
 *   async checkWallet(walletGatewayId): Promise<WalletCheck>
 *     - Checks if a wallet exists and retrieves its details.
 *     - @param {string} walletGatewayId - The wallet gateway ID to check.
 *
 *   async getOutstandingTransactions(): Promise<OutstandingTransactions>
 *     - Retrieves a list of outstanding transactions.
 */

const BaseUrl = Object.freeze({
    STAGING: 'https://gpay-staging.libyaguide.net/banking/api/onlinewallet/v1',
    PRODUCTION: 'https://gpay.ly/banking/api/onlinewallet/v1',
    DEV: "http://localhost:8080/banking/api/onlinewallet/v1"
});

class GPayApiClient {
    /**
     * @param {string} apiKey - The API key for authentication.
     * @param {string} secretKey - The secret key for signing requests.
     * @param {string} password - The password for hash token generation.
     * @param {string} baseUrl - The base URL enum value (BaseUrl.STAGING or BaseUrl.PRODUCTION).
     * @param {string} [language='en'] - The language for the response (default: 'en').
     */
    constructor(apiKey, secretKey, password, baseUrl, language = 'en') {
        if (!Object.values(BaseUrl).includes(baseUrl)) {
            throw new Error('Invalid baseUrl. Use BaseUrl.STAGING or BaseUrl.PRODUCTION.');
        }
        this.apiKey = apiKey;
        this.secretKey = secretKey;
        this.password = password;
        this.baseUrl = baseUrl;
        this.language = language;
    }

    generateSalt() {
        return crypto.randomBytes(32).toString('base64');
    }

    generateHashToken(salt, password) {
        return salt + password;
    }

    generateVerificationHash(hashToken, parameters) {
        const sortedParams = Object.keys(parameters)
            .sort()
            .reduce((obj, key) => {
                obj[key] = parameters[key];
                return obj;
            }, {});

        const queryString = Object.entries(sortedParams)
            .map(([key, value]) => `${key}=${value == null ? '' : value}`)
            .join('&');

        const verificationString = hashToken + queryString;
        const hmac = crypto.createHmac('sha256', this.secretKey);
        hmac.update(verificationString);
        return hmac.digest('base64');
    }

    async sendRequest(endpoint, parameters) {
        const salt = this.generateSalt();
        const hashToken = this.generateHashToken(salt, this.password);
        const verificationHash = await this.generateVerificationHash(hashToken, parameters);

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Accept-Language': this.language,
                'X-Signature-Salt': salt,
                'X-Signature-Hash': verificationHash,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(parameters),
        });

        const responseBody = await response.text();
        const headers = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });

        const responseJson = JSON.parse(responseBody);

        // Throw an error if the response contains an error field
        if (!responseJson) {
            throw new Error('Invalid response from GPay API: No JSON response');
        }
        if (responseJson.error) {
            const errorMsg = responseJson.error.message || 'Unknown error';
            const errorCode = responseJson.error.code || 'UNKNOWN_CODE';
            throw new Error(`GPay API Error (${errorCode}): ${errorMsg}`);
        }

        return {
            response: responseJson,
            headers,
            code: response.status,
        };
    }

    /**
     * Verifies the authenticity of a response using the response headers and response fields.
     * Throws an error if verification fails.
     * @param {Object} headers - The response headers.
     * @param {Object} responseFields - The response fields to use for verification (see api-doc.md).
     */
    verifyResponse(headers, responseFields) {
        const receivedHash = headers['x-signature-hash'] || headers['X-Signature-Hash'];
        const receivedSalt = headers['x-signature-salt'] || headers['X-Signature-Salt'];
        if (!receivedHash || !receivedSalt) {
            throw new Error('Missing X-Signature-Hash or X-Signature-Salt in response headers');
        }
        const hashToken = this.generateHashToken(receivedSalt, this.password);
        const verificationHash = this.generateVerificationHash(hashToken, responseFields);
        if (verificationHash !== receivedHash) {
            throw new Error('Response verification failed: hash mismatch');
        }
    }

    /**
     * Retrieves the current wallet balance.
     * @returns {Promise<Balance>} A promise that resolves to a Balance object containing the current available balance and response time.
     */
    async getBalance() {
        const endpoint = '/info/balance';
        const parameters = { request_timestamp: Date.now().toString() };
        const result = await this.sendRequest(endpoint, parameters);
        const data = result.response.data;
        // Response fields for verification
        this.verifyResponse(result.headers, {
            balance: data.balance,
            response_timestamp: data.response_timestamp,
        });
        return new Balance(data.balance, data.response_timestamp);
    }

    /**
     * Creates a payment request for a specified amount.
     * @param {string} amount - The amount to request.
     * @param {string} referenceNo - Optional reference number.
     * @param {string} description - Optional description.
     * @returns {Promise<PaymentRequest>} A promise that resolves to a PaymentRequest object with details of the created payment request.
     */
    async createPaymentRequest(amount, referenceNo, description) {
        const endpoint = '/payment/create-payment-request';
        const parameters = {
            amount: amount.toString(),
            reference_no: referenceNo,
            description: description,
            request_timestamp: Date.now().toString(),
        };
        const result = await this.sendRequest(endpoint, parameters);
        const data = result.response.data;
        this.verifyResponse(result.headers, {
            requester_username: data.requester_username,
            request_id: data.request_id,
            request_time: data.request_time,
            amount: data.amount,
            reference_no: data.reference_no,
            response_timestamp: data.response_timestamp,
        });
        return new PaymentRequest(
            data.requester_username,
            data.request_id,
            data.request_time,
            data.amount,
            data.reference_no,
            data.response_timestamp
        );
    }

    /**
     * Checks the status of a payment request by its request ID.
     * @param {string} requestId - The payment request ID.
     * @returns {Promise<PaymentStatus>} A promise that resolves to a PaymentStatus object with the status of the payment request.
     */
    async checkPaymentStatus(requestId) {
        const endpoint = '/payment/check-payment-status';
        const parameters = {
            request_id: requestId,
            request_timestamp: Date.now().toString(),
        };
        const result = await this.sendRequest(endpoint, parameters);
        const data = result.response.data;
        this.verifyResponse(result.headers, {
            request_id: data.request_id,
            transaction_id: data.transaction_id,
            amount: data.amount,
            payment_timestamp: data.payment_timestamp,
            reference_no: data.reference_no,
            description: data.description,
            is_paid: data.is_paid,
            response_timestamp: data.response_timestamp,
        });
        return new PaymentStatus(
            data.request_id,
            data.transaction_id,
            data.amount,
            data.payment_timestamp,
            data.reference_no,
            data.description,
            data.is_paid,
            data.response_timestamp
        );
    }

    /**
     * Sends money to another wallet.
     * @param {string} amount - The amount to send.
     * @param {string} walletGatewayId - The recipient's wallet gateway ID.
     * @param {string} referenceNo - Optional reference number.
     * @param {string} description - Optional description.
     * @returns {Promise<SendMoneyResult>} A promise that resolves to a SendMoneyResult object with details of the transaction.
     */
    async sendMoney(amount, walletGatewayId, referenceNo, description) {
        const endpoint = '/payment/send-money';
        const parameters = {
            amount: amount.toString(),
            wallet_gateway_id: walletGatewayId,
            reference_no: referenceNo,
            description: description,
            request_timestamp: Date.now().toString(),
        };
        const result = await this.sendRequest(endpoint, parameters);
        const data = result.response.data;
        this.verifyResponse(result.headers, {
            amount: data.amount,
            sender_fee: data.sender_fee,
            transaction_id: data.transaction_id,
            old_balance: data.old_balance,
            new_balance: data.new_balance,
            timestamp: data.timestamp,
            reference_no: data.reference_no,
            response_timestamp: data.response_timestamp,
        });
        return new SendMoneyResult(
            data.amount,
            data.sender_fee,
            data.transaction_id,
            data.old_balance,
            data.new_balance,
            data.timestamp,
            data.reference_no,
            data.response_timestamp
        );
    }

    /**
     * Retrieves the wallet's transaction statement for a specific day.
     * @param {string} date - The date in YYYY-MM-DD format.
     * @returns {Promise<Statement>} A promise that resolves to a Statement object containing the day's transactions and balances.
     */
    async getStatement(date) {
        const endpoint = '/info/statement';
        const parameters = {
            date,
            request_timestamp: Date.now().toString(),
        };
        const result = await this.sendRequest(endpoint, parameters);
        const data = result.response.data;
        this.verifyResponse(result.headers, {
            available_balance: data.available_balance,
            outstanding_credit: data.outstanding_credit,
            outstanding_debit: data.outstanding_debit,
            day_balance: data.day_balance,
            day_total_in: data.day_total_in,
            day_total_out: data.day_total_out,
            response_timestamp: data.response_timestamp,
        });
        const dayStatement = Array.isArray(data.day_statement)
            ? data.day_statement.map(tx => new StatementTransaction(
                tx.transaction_id,
                tx.datetime,
                tx.timestamp,
                tx.description,
                tx.amount,
                tx.balance,
                tx.reference_no,
                tx.op_type_id,
                tx.status,
                tx.created_at
            ))
            : [];
        return new Statement(
            data.available_balance,
            data.outstanding_credit,
            data.outstanding_debit,
            data.day_balance,
            data.day_total_in,
            data.day_total_out,
            data.response_timestamp,
            dayStatement
        );
    }

    /**
     * Checks if a wallet exists and retrieves its details.
     * @param {string} walletGatewayId - The wallet gateway ID to check.
     * @returns {Promise<WalletCheck>} A promise that resolves to a WalletCheck object with wallet details.
     */
    async checkWallet(walletGatewayId) {
        const endpoint = '/info/check-wallet';
        const parameters = {
            wallet_gateway_id: walletGatewayId,
            request_timestamp: Date.now().toString(),
        };
        const result = await this.sendRequest(endpoint, parameters);
        const data = result.response.data;
        this.verifyResponse(result.headers, {
            exists: data.exists,
            wallet_gateway_id: data.wallet_gateway_id,
            wallet_name: data.wallet_name,
            user_account_name: data.user_account_name,
            can_receive_money: data.can_receive_money,
            response_timestamp: data.response_timestamp,
        });
        return new WalletCheck(
            data.exists,
            data.wallet_gateway_id,
            data.wallet_name,
            data.user_account_name,
            data.can_receive_money,
            data.response_timestamp
        );
    }

    /**
     * Retrieves a list of outstanding transactions.
     * @returns {Promise<OutstandingTransactions>} A promise that resolves to an OutstandingTransactions object containing outstanding credits, debits, and transactions.
     */
    async getOutstandingTransactions() {
        const endpoint = '/info/outstanding-transactions';
        const parameters = {
            request_timestamp: Date.now().toString(),
        };
        const result = await this.sendRequest(endpoint, parameters);
        const data = result.response.data;
        this.verifyResponse(result.headers, {
            outstanding_credit: data.outstanding_credit,
            outstanding_debit: data.outstanding_debit,
            response_timestamp: data.response_timestamp,
        });
        const outstandingTransactions = Array.isArray(data.outstanding_transactions)
            ? data.outstanding_transactions.map(tx => new OutstandingTransaction(
                tx.transaction_id,
                tx.datetime,
                tx.timestamp,
                tx.description,
                tx.amount,
                tx.balance,
                tx.reference_no,
                tx.op_type_id,
                tx.status,
                tx.created_at
            ))
            : [];
        return new OutstandingTransactions(
            data.outstanding_credit,
            data.outstanding_debit,
            data.response_timestamp,
            outstandingTransactions
        );
    }
}

/**
 * Represents the wallet balance response.
 * @property {number} balance - The current available balance in LYD.
 * @property {Date} responseTime - The response timestamp as a Date object.
 */
class Balance {
    constructor(balance, responseTime) {
        this.balance = parseFloat(balance);
        this.responseTime = new Date(Number(responseTime));
    }
}

/**
 * Represents a payment request response.
 * @property {string} requesterUsername - The username of the requester.
 * @property {string} requestId - The unique ID for the payment request.
 * @property {string} requestTime - The timestamp of the request.
 * @property {number} amount - The amount requested.
 * @property {string|null} referenceNo - The reference number provided in the request.
 * @property {Date} responseTime - The response timestamp as a Date object.
 */
class PaymentRequest {
    constructor(requesterUsername, requestId, requestTime, amount, referenceNo, responseTime) {
        this.requesterUsername = requesterUsername;
        this.requestId = requestId;
        this.requestTime = requestTime;
        this.amount = parseFloat(amount);
        this.referenceNo = referenceNo;
        this.responseTime = new Date(Number(responseTime));
    }
}

/**
 * Represents the status of a payment request.
 * @property {string} requestId - The unique ID of the payment request.
 * @property {string|null} transactionId - The transaction ID if payment is completed.
 * @property {number} amount - The requested amount.
 * @property {string|null} paymentTimestamp - The payment timestamp if completed.
 * @property {string|null} referenceNo - The reference number provided in the request.
 * @property {string} description - The description provided in the request.
 * @property {boolean} isPaid - Indicates whether the payment is completed.
 * @property {Date} responseTime - The response timestamp as a Date object.
 */
class PaymentStatus {
    constructor(requestId, transactionId, amount, paymentTimestamp, referenceNo, description, isPaid, responseTime) {
        this.requestId = requestId;
        this.transactionId = transactionId;
        this.amount = parseFloat(amount);
        this.paymentTimestamp = paymentTimestamp;
        this.referenceNo = referenceNo;
        this.description = description;
        this.isPaid = isPaid;
        this.responseTime = new Date(Number(responseTime));
    }
}

/**
 * Represents the result of a send money operation.
 * @property {number} amount - The amount sent.
 * @property {number} senderFee - The fee charged to the sender.
 * @property {string} transactionId - The unique ID for the transaction.
 * @property {number} oldBalance - The balance before the transaction.
 * @property {number} newBalance - The balance after the transaction.
 * @property {string} timestamp - The timestamp of the transaction.
 * @property {string|null} referenceNo - The reference number provided in the request.
 * @property {Date} responseTime - The response timestamp as a Date object.
 */
class SendMoneyResult {
    constructor(amount, senderFee, transactionId, oldBalance, newBalance, timestamp, referenceNo, responseTime) {
        this.amount = parseFloat(amount);
        this.senderFee = parseFloat(senderFee);
        this.transactionId = transactionId;
        this.oldBalance = parseFloat(oldBalance);
        this.newBalance = parseFloat(newBalance);
        this.timestamp = timestamp;
        this.referenceNo = referenceNo;
        this.responseTime = new Date(Number(responseTime));
    }
}

/**
 * Represents a wallet statement for a specific day.
 * @property {number} availableBalance - The available balance at the time of the request.
 * @property {number} outstandingCredit - The total outstanding credit.
 * @property {number} outstandingDebit - The total outstanding debit.
 * @property {number} dayBalance - The balance at the end of the given day.
 * @property {number} dayTotalIn - The total credited on the given day.
 * @property {number} dayTotalOut - The total debited on the given day.
 * @property {Date} responseTime - The response timestamp as a Date object.
 * @property {StatementTransaction[]} dayStatement - The list of transactions for the given day.
 */
class Statement {
    constructor(availableBalance, outstandingCredit, outstandingDebit, dayBalance, dayTotalIn, dayTotalOut, responseTime, dayStatement) {
        this.availableBalance = parseFloat(availableBalance);
        this.outstandingCredit = parseFloat(outstandingCredit);
        this.outstandingDebit = parseFloat(outstandingDebit);
        this.dayBalance = parseFloat(dayBalance);
        this.dayTotalIn = parseFloat(dayTotalIn);
        this.dayTotalOut = parseFloat(dayTotalOut);
        this.responseTime = new Date(Number(responseTime));
        this.dayStatement = dayStatement;
    }
}

/**
 * Represents a transaction in a wallet statement.
 * @property {string} transactionId - The unique ID of the transaction.
 * @property {string} datetime - The date and time of the transaction.
 * @property {string} timestamp - The timestamp of the transaction.
 * @property {string} description - The description of the transaction.
 * @property {number|null} amount - The amount of the transaction.
 * @property {number|null} balance - The balance after the transaction.
 * @property {string|null} referenceNo - The reference number associated with the transaction.
 * @property {number} opTypeId - The operation type ID (value from the OperationType enumeration).
 * @property {number} status - The status of the transaction (value from the TransactionStatus enumeration).
 * @property {string} createdAt - The timestamp when the transaction was created.
 */
class StatementTransaction {
    constructor(transactionId, datetime, timestamp, description, amount, balance, referenceNo, opTypeId, status, createdAt) {
        this.transactionId = transactionId;
        this.datetime = datetime;
        this.timestamp = timestamp;
        this.description = description;
        this.amount = amount !== undefined && amount !== null ? parseFloat(amount) : null;
        this.balance = balance !== undefined && balance !== null ? parseFloat(balance) : null;
        this.referenceNo = referenceNo;
        this.opTypeId = opTypeId;
        this.status = status;
        this.createdAt = createdAt;
    }
}

/**
 * Represents the result of checking a wallet.
 * @property {boolean} exists - Whether the wallet exists.
 * @property {string} walletGatewayId - The wallet gateway ID.
 * @property {string|null} walletName - The name of the wallet.
 * @property {string|null} userAccountName - The user account name.
 * @property {boolean} canReceiveMoney - Whether the wallet can receive money.
 * @property {Date} responseTime - The response timestamp as a Date object.
 */
class WalletCheck {
    constructor(exists, walletGatewayId, walletName, userAccountName, canReceiveMoney, responseTime) {
        this.exists = exists;
        this.walletGatewayId = walletGatewayId;
        this.walletName = walletName;
        this.userAccountName = userAccountName;
        this.canReceiveMoney = canReceiveMoney;
        this.responseTime = new Date(Number(responseTime));
    }
}

/**
 * Represents a list of outstanding transactions.
 * @property {number} outstandingCredit - The total outstanding credit.
 * @property {number} outstandingDebit - The total outstanding debit.
 * @property {Date} responseTime - The response timestamp as a Date object.
 * @property {OutstandingTransaction[]} outstandingTransactions - The list of outstanding transactions.
 */
class OutstandingTransactions {
    constructor(outstandingCredit, outstandingDebit, responseTime, outstandingTransactions) {
        this.outstandingCredit = parseFloat(outstandingCredit);
        this.outstandingDebit = parseFloat(outstandingDebit);
        this.responseTime = new Date(Number(responseTime));
        this.outstandingTransactions = outstandingTransactions;
    }
}

/**
 * Represents an outstanding transaction.
 * @property {string} transactionId - The unique ID of the transaction.
 * @property {string} datetime - The date and time of the transaction.
 * @property {string} timestamp - The timestamp of the transaction.
 * @property {string} description - The description of the transaction.
 * @property {number|null} amount - The amount of the transaction.
 * @property {number|null} balance - The balance after the transaction.
 * @property {string|null} referenceNo - The reference number associated with the transaction.
 * @property {number} opTypeId - The operation type ID (value from the OperationType enumeration).
 * @property {number} status - The status of the transaction (value from the TransactionStatus enumeration).
 * @property {string} createdAt - The timestamp when the transaction was created.
 */
class OutstandingTransaction {
    constructor(transactionId, datetime, timestamp, description, amount, balance, referenceNo, opTypeId, status, createdAt) {
        this.transactionId = transactionId;
        this.datetime = datetime;
        this.timestamp = timestamp;
        this.description = description;
        this.amount = amount !== undefined && amount !== null ? parseFloat(amount) : null;
        this.balance = balance !== undefined && balance !== null ? parseFloat(balance) : null;
        this.referenceNo = referenceNo;
        this.opTypeId = opTypeId;
        this.status = status;
        this.createdAt = createdAt;
    }
}

/**
 * Enum for transaction status values.
 * @readonly
 * @enum {number}
 * @property {number} PENDING - 0: Operation initiated, pending completion.
 * @property {number} COMPLETED - 1: Operation completed, not yet applied to balance.
 * @property {number} APPLIED - 2: Transaction applied to balance.
 */
const TransactionStatus = Object.freeze({
    PENDING: 0,
    COMPLETED: 1,
    APPLIED: 2,
    0: 'PENDING',
    1: 'COMPLETED',
    2: 'APPLIED',
});

/**
 * Enum for operation type values.
 * @readonly
 * @enum {number}
 * @property {number} DIRECT_TRANSFER - 1: Direct money transfer.
 * @property {number} PAYMENT_REQUEST - 2: Payment made using a payment request.
 * @property {number} BANK_DEPOSIT - 3: Cash-in bank deposit.
 * @property {number} BANK_WITHDRAW - 4: Cash-out bank withdraw.
 * @property {number} TRANSACTION_FEE - 5: Transaction fee deduction.
 * @property {number} LOCAL_TRANSFER - 6: Local transfer between wallets of the primary owner.
 */
const OperationType = Object.freeze({
    DIRECT_TRANSFER: 1,
    PAYMENT_REQUEST: 2,
    BANK_DEPOSIT: 3,
    BANK_WITHDRAW: 4,
    TRANSACTION_FEE: 5,
    LOCAL_TRANSFER: 6,
    1: 'DIRECT_TRANSFER',
    2: 'PAYMENT_REQUEST',
    3: 'BANK_DEPOSIT',
    4: 'BANK_WITHDRAW',
    5: 'TRANSACTION_FEE',
    6: 'LOCAL_TRANSFER',
});

export { BaseUrl, TransactionStatus, OperationType, OutstandingTransaction, OutstandingTransactions, WalletCheck, StatementTransaction, Statement, SendMoneyResult, PaymentStatus, PaymentRequest, Balance };
export default GPayApiClient;
