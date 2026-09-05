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

// The registered route is /chamas/:id/invitations/:invitationId/cancel --
// chamaId is not optional here (unlike respondToInvitation, this is a
// leadership action scoped to one chama). Calling without it used to hit
// /chamas/invitations/:invitationId/cancel, which matches no route at all
// (a 404), so the "Cancel" button in the sent-invitations list silently did
// nothing.
const cancelInvitation = async (chamaId, invitationId) => {
  return await makeRequest(`/chamas/${chamaId}/invitations/${invitationId}/cancel`, {
    method: 'POST',
  });
};

const resendInvitation = async (chamaId, invitationId) => {
  return await makeRequest(`/chamas/${chamaId}/invitations/${invitationId}/resend`, {
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