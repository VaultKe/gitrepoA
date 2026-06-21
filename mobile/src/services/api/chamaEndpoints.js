import { makeRequest, makeRequestWithRetry } from './client';

const getChamas = async (limit = 20, offset = 0) => {
  return await makeRequest(`/chamas/?limit=${limit}&offset=${offset}`);
};

const getAllChamasForAdmin = async (limit = 100, offset = 0) => {
  return await makeRequest(`/chamas/admin/all?limit=${limit}&offset=${offset}`);
};

const getUserChamas = async (limit = 20, offset = 0) => {
  return await makeRequest(`/chamas/my?limit=${limit}&offset=${offset}`);
};

const getChamaById = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}`);
};

const getChamaStatistics = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/statistics`);
};

const getChamaMembers = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/members`);
};

const getChamaTransactions = async (chamaId, limit = 20, offset = 0) => {
  return await makeRequest(`/chamas/${chamaId}/transactions?limit=${limit}&offset=${offset}`);
};

const getMerryGoRounds = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/merry-go-rounds`);
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

export {
  getChamas,
  getAllChamasForAdmin,
  getUserChamas,
  getChamaById,
  getChamaStatistics,
  getChamaMembers,
  getChamaTransactions,
  getMerryGoRounds,
  createMerryGoRound,
  createChama,
  updateChama,
  createChamaChatRoom,
  joinChama,
  leaveChama,
  getMemberRole,
  getActiveVotes,
  getVoteResults,
  createVote,
  castVote,
  createRoleEscalationPoll,
};
