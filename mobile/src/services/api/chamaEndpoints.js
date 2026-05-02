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

export {
  getChamas,
  getAllChamasForAdmin,
  getUserChamas,
  getChamaById,
  getChamaStatistics,
  getChamaMembers,
  getChamaTransactions,
  getMerryGoRounds,
  createChama,
  updateChama,
  joinChama,
  leaveChama,
};