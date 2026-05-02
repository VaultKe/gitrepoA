import { makeRequest, makeRequestWithRetry } from './client';

const sendChamaInvitation = async (chamaId, invitationData) => {
  return await makeRequest(`/chamas/${chamaId}/invite`, {
    method: 'POST',
    body: invitationData,
  });
};

const getUserInvitations = async () => {
  return await makeRequest('/chamas/invitations');
};

const respondToInvitation = async (invitationId, response, chamaId = null) => {
  const url = chamaId
    ? `/chamas/${chamaId}/invitations/${invitationId}/respond`
    : `/chamas/invitations/${invitationId}/respond`;
  return await makeRequest(url, {
    method: 'POST',
    body: { response },
  });
};

const getChamaSentInvitations = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/invitations/sent`);
};

const cancelInvitation = async (invitationId) => {
  return await makeRequest(`/chamas/invitations/${invitationId}/cancel`, {
    method: 'POST',
  });
};

const resendInvitation = async (invitationId) => {
  return await makeRequest(`/chamas/invitations/${invitationId}/resend`, {
    method: 'POST',
  });
};

export {
  sendChamaInvitation,
  getUserInvitations,
  respondToInvitation,
  getChamaSentInvitations,
  cancelInvitation,
  resendInvitation,
};