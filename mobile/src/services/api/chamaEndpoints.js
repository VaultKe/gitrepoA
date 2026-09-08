import { makeRequest, makeRequestWithRetry } from './client';
import { API_BASE_URL, getAuthToken } from './auth';

const getChamas = async (limit = 20, offset = 0) => {
  return await makeRequest(`/chamas/?limit=${limit}&offset=${offset}`);
};

const getAllChamasForAdmin = async (limit = 100, offset = 0) => {
  return await makeRequest(`/chamas/admin/all?limit=${limit}&offset=${offset}`);
};

const getUserChamas = async (limit = 20, offset = 0) => {
  return await makeRequestWithRetry(`/chamas/my?limit=${limit}&offset=${offset}`);
};

const getChamaById = async (chamaId) => {
  return await makeRequestWithRetry(`/chamas/${chamaId}`);
};

const getChamaStatistics = async (chamaId) => {
  return await makeRequestWithRetry(`/chamas/${chamaId}/statistics`);
};

const getChamaMembers = async (chamaId, queryParams = {}) => {
  const queryString = new URLSearchParams(queryParams).toString();
  const endpoint = `/chamas/${chamaId}/members${queryString ? `?${queryString}` : ''}`;
  return await makeRequestWithRetry(endpoint);
};

const getChamaMember = async (chamaId, memberId) => {
  return await makeRequestWithRetry(`/chamas/${chamaId}/members/${memberId}`);
};

const exportChamaMembers = async (chamaId) => {
  // This returns a blob for file download
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE_URL}/chamas/${chamaId}/members/export`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Export failed: ${response.status} ${errorText}`);
  }
  
  return response.blob();
};

const getChamaTransactions = async (chamaId, limit = 20, offset = 0) => {
  return await makeRequest(`/chamas/${chamaId}/transactions?limit=${limit}&offset=${offset}`);
};

const getMerryGoRounds = async (chamaId) => {
  return await makeRequestWithRetry(`/chamas/${chamaId}/merry-go-rounds`);
};

const getMerryGoRoundPayments = async (roundId) => {
  return await makeRequest(`/merry-go-rounds/${roundId}/payments`);
};

const getMerryGoRoundContributionStatus = async (chamaId, roundId = null) => {
  const queryParams = roundId ? `?roundId=${roundId}` : '';
  return await makeRequestWithRetry(`/merry-go-rounds/contribution-status/${chamaId}${queryParams}`);
};

const createMerryGoRound = async (data) => {
  return await makeRequest('/merry-go-rounds/', {
    method: 'POST',
    body: data,
  });
};

const createChama = async (chamaData) => {
  return await makeRequest('/chamas/', {
    method: 'POST',
    body: chamaData,
  });
};

const updateChama = async (chamaId, updateData) => {
  return await makeRequest(`/chamas/${chamaId}`, {
    method: 'PUT',
    body: updateData,
  });
};

const createChamaChatRoom = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/create-chat-room`, {
    method: 'POST',
  });
};

const joinChama = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/join`, {
    method: 'POST',
  });
};

const leaveChama = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/leave`, {
    method: 'POST',
  });
};

const getMemberRole = async (chamaId, userId) => {
  return await makeRequestWithRetry(`/chamas/${chamaId}/members/${userId}/role`);
};

const getActiveVotes = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/votes/active`);
};

const getVoteResults = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/votes/results`);
};

const getChamaVotes = async (chamaId, limit = 50, offset = 0) => {
  return await makeRequest(`/chamas/${chamaId}/polls?limit=${limit}&offset=${offset}`);
};

const getChamaPolls = async (chamaId, limit = 50, offset = 0) => {
  return await makeRequest(`/chamas/${chamaId}/polls?limit=${limit}&offset=${offset}`);
};

const getActivePolls = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/polls/active`);
};

const getPollResults = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/polls/results`);
};

const getPollDetails = async (chamaId, pollId) => {
  return await makeRequest(`/chamas/${chamaId}/polls/${pollId}`);
};

const createPoll = async (chamaId, data) => {
  return await makeRequest(`/chamas/${chamaId}/votes`, {
    method: 'POST',
    body: data,
  });
};

const createRegularPoll = async (chamaId, data) => {
  const payload = {
    title: data.title,
    ...(data.description && { description: data.description }),
    poll_type: data.type || data.poll_type || 'general',
    end_date: data.ends_at || data.end_date,
    is_anonymous: data.isAnonymous ?? true,
    requires_majority: data.requiresMajority ?? true,
    majority_percentage: data.majorityPercentage ?? 50,
    options: (data.options || []).map((opt) => ({
      option_text: opt.option_text || opt.optionText || String(opt),
    })),
    ...(data.metadata && { metadata: data.metadata }),
  };

  return await makeRequest(`/chamas/${chamaId}/polls`, {
    method: 'POST',
    body: payload,
  });
};

const castPollVote = async (chamaId, pollId, optionId) => {
  return await makeRequest(`/chamas/${chamaId}/polls/${pollId}/vote`, {
    method: 'POST',
    body: { option_id: optionId },
  });
};

const createRoleEscalationPoll = async (chamaId, data) => {
  return await makeRequest(`/chamas/${chamaId}/votes/role-escalation`, {
    method: 'POST',
    body: data,
  });
};

const getChamaSubscriptionPayments = async (chamaId) => {
  const url = `/chamas/${chamaId}/subscription-payments`;
  return await makeRequest(url);
};

const paySubscriptionPayment = async (chamaId, paymentId) => {
  return await makeRequest(`/chamas/${chamaId}/subscription-payments/${paymentId}/pay`, {
    method: 'POST',
  });
};

const getChamaServiceFeePayments = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/service-fee-payments`);
};

const getMemberServiceFeePayments = async (chamaId, memberId) => {
  return await makeRequest(`/chamas/${chamaId}/members/${memberId}/service-fee-payments`);
};

const payServiceFeePayment = async (chamaId, paymentId) => {
  return await makeRequest(`/chamas/${chamaId}/service-fee-payments/${paymentId}/pay`, {
    method: 'POST',
  });
};

const payMemberServiceFee = async (chamaId, memberId) => {
  return await makeRequest(`/chamas/${chamaId}/members/${memberId}/pay-service-fee`, {
    method: 'POST',
  });
};

const addMemberToChama = async (chamaId, userId, role = 'member') => {
  return await makeRequest(`/chamas/${chamaId}/members`, {
    method: 'POST',
    body: { userId, role },
  });
};

const removeMemberFromChama = async (chamaId, memberId) => {
  return await makeRequest(`/chamas/${chamaId}/members/${memberId}`, {
    method: 'DELETE',
  });
};

const updateMemberRole = async (chamaId, memberId, newRole) => {
  return await makeRequest(`/chamas/${chamaId}/members/${memberId}/role`, {
    method: 'PUT',
    body: { role: newRole },
  });
};

const deleteChama = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}`, {
    method: 'DELETE',
  });
};

const getChama = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}`);
};

const getChamaWalletBalance = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/wallet/balance`);
};

const disburseMerryGoRoundCycle = async (chamaId, cycleId, data) => {
  return await makeRequest(`/chamas/${chamaId}/mgr-disbursements/${cycleId}`, {
    method: 'POST',
    body: data,
  });
};

const disburseMerryGoRoundCyclesBulk = async (chamaId, data) => {
  return await makeRequest(`/chamas/${chamaId}/mgr-disbursements/bulk`, {
    method: 'POST',
    body: data,
  });
};

// Two-signature merry-go-round payout.
// Step 1: the treasurer initiates. The server computes the amount actually
// collected for the current round and e-mails a confirmation code to the
// chairperson.
const initiateMerryGoRoundDisbursement = async (chamaId, cycleId, data = {}) => {
  return await makeRequest(`/chamas/${chamaId}/mgr-disbursements/${cycleId}/initiate`, {
    method: 'POST',
    body: data,
  });
};

// Step 2: the chairperson confirms with the e-mailed code. On success the B2C
// payout to the recipient's M-Pesa fires immediately.
const confirmMerryGoRoundDisbursement = async (chamaId, cycleId, otp) => {
  return await makeRequest(`/chamas/${chamaId}/mgr-disbursements/${cycleId}/confirm`, {
    method: 'POST',
    body: { otp },
  });
};

// Round-by-round disbursement ledger for the chama: rounds collected and still
// needing a payout, rounds awaiting the chairperson's code, and records of
// rounds already paid out (amount, date, M-Pesa code).
const getMerryGoRoundDisbursements = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/mgr-disbursements`);
};

export {
  getChamas,
  getAllChamasForAdmin,
  getUserChamas,
  getChamaById,
  getChamaStatistics,
  getChamaMembers,
  getChamaMember,
  exportChamaMembers,
  getChamaTransactions,
  getMerryGoRounds,
  getMerryGoRoundPayments,
  getMerryGoRoundContributionStatus,
  createMerryGoRound,
  joinChama,
  leaveChama,
  getMemberRole,
  getActiveVotes,
  getVoteResults,
  getChamaVotes,
  getChamaPolls,
  getActivePolls,
  getPollResults,
  getPollDetails,
  createPoll,
  createRegularPoll,
  castPollVote,
  createRoleEscalationPoll,
  addMemberToChama,
  removeMemberFromChama,
  deleteChama,
  getChama,
  updateMemberRole,
  createChama,
  updateChama,
  getChamaWalletBalance,
  createChamaChatRoom,
  getChamaSubscriptionPayments,
  paySubscriptionPayment,
  getChamaServiceFeePayments,
  getMemberServiceFeePayments,
  payServiceFeePayment,
  payMemberServiceFee,
  disburseMerryGoRoundCycle,
  disburseMerryGoRoundCyclesBulk,
  initiateMerryGoRoundDisbursement,
  confirmMerryGoRoundDisbursement,
  getMerryGoRoundDisbursements,
};