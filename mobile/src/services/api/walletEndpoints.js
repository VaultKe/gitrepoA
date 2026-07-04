import { makeRequest, makeRequestWithRetry } from './client';

const getWalletBalance = async () => {
  return await makeRequest('/wallets/balance');
};

const getTransactions = async (limit = 20, offset = 0) => {
  return await makeRequest(`/wallets/transactions?limit=${limit}&offset=${offset}`);
};

const getSubWalletTransactions = async (chamaId, walletType) => {
  return await makeRequest(`/chamas/${chamaId}/subwallets/${walletType}/transactions`);
};

const initiateDeposit = async (amount, paymentMethod = 'mpesa', description = '', reference = '') => {
  return await makeRequest('/wallets/deposit', {
    method: 'POST',
    body: {
      amount,
      paymentMethod,
      description: description || `Deposit via ${paymentMethod}`,
      reference
    },
  });
};

const initiateWithdrawal = async (amount, withdrawMethod, phoneNumber = '', bankAccountNumber = '', bankCode = '', description = '') => {
  const body = {
    amount,
    withdrawMethod,
    description: description || `Withdrawal via ${withdrawMethod}`,
  };

  if (withdrawMethod === 'mpesa') {
    body.phoneNumber = phoneNumber;
  } else if (withdrawMethod === 'bank') {
    body.bankAccountNumber = bankAccountNumber;
    body.bankCode = bankCode;
  }

  return await makeRequest('/wallets/withdraw', {
    method: 'POST',
    body,
  });
};

const getChamaWalletBalance = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/wallet/balance`);
};

const transferMoney = ({ amount, recipientId, description = '', pin = '' }) => {
  return makeRequest('/wallets/transfer', {
    method: 'POST',
    body: { amount, recipientId, description, pin },
  });
};

const initiateRegistrationPayment = async (amount = 50, phoneNumber = '', paymentType = 'chama', targetId = '') => {
  return await makeRequest('/wallets/registration-payment', {
    method: 'POST',
    body: {
      amount,
      phoneNumber,
      paymentType,
      targetId,
      description: 'Chama registration fee',
    },
  });
};

export {
  getWalletBalance,
  getTransactions,
  getSubWalletTransactions,
  initiateDeposit,
  initiateWithdrawal,
  getChamaWalletBalance,
  initiateRegistrationPayment,
};