// Type definitions for gpay-nodejs-sdk
// Project: https://github.com/yourusername/gpay-nodejs-sdk
// Definitions by: Your Name <your.email@example.com>

export = GpayApiClient;

/**
 * Main class for GPay API Client
 */
declare class GpayApiClient {
    constructor(
        apiKey: string,
        secretKey: string,
        password: string,
        baseUrl: string,
        language?: string
    );

    getBalance(): Promise<Balance>;
    createPaymentRequest(
        amount: number | string,
        referenceNo: string,
        description: string
    ): Promise<PaymentRequest>;
    checkPaymentStatus(requestId: string): Promise<PaymentStatus>;
    sendMoney(
        amount: number | string,
        walletGatewayId: string,
        referenceNo: string,
        description: string
    ): Promise<SendMoneyResult>;
    getStatement(date: string): Promise<Statement>;
    checkWallet(walletGatewayId: string): Promise<WalletCheck>;
    getOutstandingTransactions(): Promise<OutstandingTransactions>;
}

export default GpayApiClient;

// Optionally, declare and export the other types/classes if you want users to use them:
export interface Balance {
    balance: number;
    responseTime: Date;
}

export interface PaymentRequest {
    requesterUsername: string;
    requestId: string;
    requestTime: string;
    amount: number;
    referenceNo: string | null;
    responseTime: Date;
}

export interface PaymentStatus {
    requestId: string;
    transactionId: string | null;
    amount: number;
    paymentTimestamp: string | null;
    referenceNo: string | null;
    description: string;
    isPaid: boolean;
    responseTime: Date;
}

export interface SendMoneyResult {
    amount: number;
    senderFee: number;
    transactionId: string;
    oldBalance: number;
    newBalance: number;
    timestamp: string;
    referenceNo: string | null;
    responseTime: Date;
}

export interface Statement {
    availableBalance: number;
    outstandingCredit: number;
    outstandingDebit: number;
    dayBalance: number;
    dayTotalIn: number;
    dayTotalOut: number;
    responseTime: Date;
    dayStatement: StatementTransaction[];
}

export interface StatementTransaction {
    transactionId: string;
    datetime: string;
    timestamp: string;
    description: string;
    amount: number | null;
    balance: number | null;
    referenceNo: string | null;
    opTypeId: number;
    status: number;
    createdAt: string;
}

export interface WalletCheck {
    exists: boolean;
    walletGatewayId: string;
    walletName: string | null;
    userAccountName: string | null;
    canReceiveMoney: boolean;
    responseTime: Date;
}

export interface OutstandingTransactions {
    outstandingCredit: number;
    outstandingDebit: number;
    responseTime: Date;
    outstandingTransactions: OutstandingTransaction[];
}

export interface OutstandingTransaction {
    transactionId: string;
    datetime: string;
    timestamp: string;
    description: string;
    amount: number | null;
    balance: number | null;
    referenceNo: string | null;
    opTypeId: number;
    status: number;
    createdAt: string;
}

declare const BaseUrl: {
  readonly STAGING: string;
  readonly PRODUCTION: string;
};

declare const OperationType: {
  readonly DIRECT_TRANSFER: number;
  readonly PAYMENT_REQUEST: number;
  readonly BANK_DEPOSIT: number;
  readonly BANK_WITHDRAW: number;
  readonly TRANSACTION_FEE: number;
  readonly LOCAL_TRANSFER: number;
  readonly [key: number]: string;
};

declare const TransactionStatus: {
  readonly PENDING: number;
  readonly COMPLETED: number;
  readonly APPLIED: number;
  readonly [key: number]: string;
};

export { BaseUrl, OperationType, TransactionStatus };
