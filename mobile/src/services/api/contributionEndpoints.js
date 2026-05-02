import { makeRequest, makeRequestWithRetry } from './client';

const makeContribution = async (contributionData) => {
  return await makeRequest('/contributions', {
    method: 'POST',
    body: contributionData,
  });
};

const getContributions = async (chamaId, limit = 20, offset = 0) => {
  return await makeRequest(`/contributions?chamaId=${chamaId}&limit=${limit}&offset=${offset}`);
};

export {
  makeContribution,
  getContributions,
};