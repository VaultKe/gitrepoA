import { makeRequest, makeRequestWithRetry } from './client';
import { getUserChamas } from './chamaEndpoints';

const getLoans = async (chamaId, limit = 20, offset = 0) => {
  const response = await makeRequest(`/loans/?chamaId=${chamaId}&limit=${limit}&offset=${offset}&includeUserContext=true`);

  if (response.success && response.data && response.data.length > 0) {
    const enrichedLoans = await Promise.all(
      response.data.map(async (loan) => {
        try {
          const userId = loan.borrowerId || loan.borrower_id || loan.applicant_id || loan.user_id;
          if (userId) {
            const userResponse = await makeRequest(`/users/${userId}`);
            if (userResponse.success && userResponse.data) {
              const userData = userResponse.data;
              const fullName = `${userData.firstName || userData.first_name || ''} ${userData.lastName || userData.last_name || ''}`.trim();
              return {
                ...loan,
                applicant: {
                  id: userData.id,
                  first_name: userData.firstName || userData.first_name,
                  last_name: userData.lastName || userData.last_name,
                  name: fullName,
                  username: userData.username || userData.email
                },
                applicant_name: fullName,
                borrower_id: userId,
                user_id: userId
              };
            } else {
              const fallbackUserId = userId;
              return {
                ...loan,
                applicant: {
                  id: fallbackUserId,
                  first_name: 'Unknown',
                  last_name: 'User',
                  name: 'Unknown User',
                  username: 'unknown'
                },
                applicant_name: 'Unknown User',
                borrower_id: fallbackUserId,
                user_id: fallbackUserId
              };
            }
          }
          return {
            ...loan,
            applicant: {
              id: 'unknown',
              first_name: 'Unknown',
              last_name: 'User',
              name: 'Unknown User',
              username: 'unknown'
            },
            applicant_name: 'Unknown User'
          };
        } catch (userError) {
          const fallbackUserId = loan.borrowerId || loan.borrower_id || loan.applicant_id || loan.user_id || 'unknown';
          return {
            ...loan,
            applicant: {
              id: fallbackUserId,
              first_name: 'Unknown',
              last_name: 'User',
              name: 'Unknown User',
              username: 'unknown'
            },
            applicant_name: 'Unknown User',
            borrower_id: fallbackUserId,
            user_id: fallbackUserId
          };
        }
      })
    );
    return { ...response, data: enrichedLoans };
  }
  return response;
};

const applyForLoan = async (loanData) => {
  return await makeRequest('/loans/apply', {
    method: 'POST',
    body: loanData,
  });
};

const respondToGuarantorRequest = async (loanId, response) => {
  return await makeRequest(`/loans/${loanId}/guarantor-response`, {
    method: 'POST',
    body: response,
  });
};

const approveLoan = async (loanId, approvalData) => {
  return await makeRequest(`/loans/${loanId}/approve`, {
    method: 'POST',
    body: approvalData,
  });
};

const makeLoanPayment = async (loanId, amount, paymentMethod) => {
  return await makeRequest(`/loans/${loanId}/payments`, {
    method: 'POST',
    body: { amount, paymentMethod },
  });
};

const getGuarantorRequests = async (userId) => {
  return await makeRequest(`/loans/guarantor-requests?userId=${userId}`);
};

const rejectLoan = async (loanId, reason) => {
  return await makeRequest(`/loans/${loanId}/reject`, {
    method: 'POST',
    body: { reason },
  });
};

const disburseLoan = async (loanId) => {
  return await makeRequest(`/loans/${loanId}/disburse`, {
    method: 'POST',
  });
};

const getLoanTypes = async (chamaId, status = '') => {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return await makeRequest(`/loans/${chamaId}/loan-types${qs}`);
};

const getLoanType = async (loanTypeId) => {
  return await makeRequest(`/loans/loan-types/${loanTypeId}`);
};

const createLoanType = async (chamaId, data) => {
  return await makeRequest(`/loans/${chamaId}/loan-types`, {
    method: 'POST',
    body: data,
  });
};

const updateLoanType = async (loanTypeId, data) => {
  return await makeRequest(`/loans/loan-types/${loanTypeId}`, {
    method: 'PUT',
    body: data,
  });
};

const deleteLoanType = async (loanTypeId) => {
  return await makeRequest(`/loans/loan-types/${loanTypeId}`, {
    method: 'DELETE',
  });
};

export {
  getLoans,
  applyForLoan,
  respondToGuarantorRequest,
  approveLoan,
  makeLoanPayment,
  getGuarantorRequests,
  rejectLoan,
  disburseLoan,
  getLoanTypes,
  getLoanType,
  createLoanType,
  updateLoanType,
  deleteLoanType,
};