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
  return await makeRequest(`/chamas/${chamaId}`);
};

const getChamaStatistics = async (chamaId) => {
  return await makeRequestWithRetry(`/chamas/${chamaId}/statistics`);
};

const getChamaMembers = async (chamaId) => {
  return await makeRequestWithRetry(`/chamas/${chamaId}/members`);
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
  return await makeRequest(`/chamas/${chamaId}/merry-go-rounds`);
};

const getMerryGoRoundPayments = async (roundId) => {
  return await makeRequest(`/merry-go-rounds/${roundId}/payments`);
};

const getMerryGoRoundContributionStatus = async (chamaId, roundId = null) => {
  const queryParams = roundId ? `?roundId=${roundId}` : '';
  return await makeRequest(`/merry-go-rounds/contribution-status/${chamaId}${queryParams}`);
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
  return await makeRequest(`/chamas/${chamaId}/members/${userId}/role`);
};

const getActiveVotes = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/votes/active`);
};

const getVoteResults = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/votes/results`);
};

const createVote = async (chamaId, data) => {
  return await makeRequest(`/chamas/${chamaId}/votes`, {
    method: 'POST',
    body: data,
  });
};

const castVote = async (chamaId, voteId, optionId) => {
  return await makeRequest(`/chamas/${chamaId}/votes/${voteId}/vote`, {
    method: 'POST',
    body: { optionId },
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
  createVote,
  castVote,
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
};