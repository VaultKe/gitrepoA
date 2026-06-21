import { makeRequest } from './client';

const getWelfareRequests = async (chamaId, limit = 100, offset = 0) => {
  const q = `?chamaId=${encodeURIComponent(chamaId)}&limit=${limit}&offset=${offset}`;
  return await makeRequest(`/welfare/${q}`);
};

const getWelfareContributions = async (welfareId, limit = 100, offset = 0) => {
  return await makeRequest(`/welfare/${encodeURIComponent(welfareId)}/contributions?limit=${limit}&offset=${offset}`);
};

const createWelfareRequest = async (data) => {
  return await makeRequest('/welfare/', {
    method: 'POST',
    body: data,
  });
};

const voteOnWelfareRequest = async (requestId, vote) => {
  return await makeRequest(`/welfare/${encodeURIComponent(requestId)}/vote`, {
    method: 'POST',
    body: { vote },
  });
};

const contributeToWelfare = async (data) => {
  return await makeRequest('/welfare/contribute', {
    method: 'POST',
    body: data,
  });
};

const disburseWelfareFund = async (chamaId, disbursementData) => {
  const payload = {
    type: 'welfare_disbursement',
    category: 'welfare',
    memberId: disbursementData.recipientId,
    memberName: disbursementData.recipientName,
    amount: disbursementData.amount,
    purpose: disbursementData.description || 'Welfare disbursement',
    privateNote: disbursementData.privateNote || '',
    fromAccount: `chama-${chamaId}`,
    toAccount: `wallet-personal-${disbursementData.recipientId}`,
    initiatedBy: disbursementData.initiatedBy,
    initiatedById: disbursementData.initiatedById,
    timestamp: disbursementData.timestamp,
    status: 'completed',
    transactionId: `TXN_${Date.now()}`,
    securityHash: `SHA256_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  };
  return await makeRequest(`/chamas/${chamaId}/disbursements/individual`, {
    method: 'POST',
    body: payload,
  });
};

const bulkDisburseWelfareFunds = async (chamaId, bulkData) => {
  const totalAmount = bulkData.funds.reduce((sum, fund) => sum + (fund.amount || 0), 0);
  const count = bulkData.funds.length || 1;
  const perShare = totalAmount / count;
  const eligibleMembers = bulkData.funds.map(fund => ({
    id: fund.recipientId,
    name: fund.recipientName,
    amount: fund.amount,
    sharesOwned: 1,
  }));
  const payload = {
    type: 'welfare_disbursement',
    category: 'welfare',
    dividendPerShare: perShare,
    totalAmount,
    description: bulkData.description,
    eligibleMembers,
    fromAccount: `chama-${chamaId}`,
    initiatedBy: bulkData.initiatedBy,
    initiatedById: bulkData.initiatedById,
    timestamp: bulkData.timestamp,
    status: 'completed',
    transactionId: `TXN_${Date.now()}`,
    securityHash: `SHA256_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  };
  return await makeRequest(`/chamas/${chamaId}/disbursements/bulk`, {
    method: 'POST',
    body: payload,
  });
};

export {
  getWelfareRequests,
  getWelfareContributions,
  createWelfareRequest,
  voteOnWelfareRequest,
  contributeToWelfare,
  disburseWelfareFund,
  bulkDisburseWelfareFunds,
};
