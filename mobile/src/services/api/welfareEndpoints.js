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

export {
  getWelfareRequests,
  getWelfareContributions,
  createWelfareRequest,
  voteOnWelfareRequest,
  contributeToWelfare,
};
