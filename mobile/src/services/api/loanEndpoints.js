import { makeRequest, makeRequestWithRetry } from './client';
import { getUserChamas } from './chamaEndpoints';

const getLoans = async (chamaId, limit = 20, offset = 0) => {
  const response = await makeRequest(`/loans/?chamaId=${chamaId}&limit=${limit}&offset=${offset}&includeUserContext=true`);

  if (response.success && Array.isArray(response.data) && response.data.length > 0) {
    const enrichedLoans = response.data.map((loan) => {
      const borrower = loan.borrower || {};
      const fullName = `${borrower.firstName || ''} ${borrower.lastName || ''}`.trim() || 'Unknown User';
      return {
        ...loan,
        applicant: {
          id: borrower.id || loan.borrowerId,
          first_name: borrower.firstName,
          last_name: borrower.lastName,
          name: fullName,
          username: borrower.username || borrower.email,
        },
        applicant_name: fullName,
        borrower_id: loan.borrowerId,
        user_id: loan.borrowerId,
      };
    });
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

const getLoanGuarantors = async (loanId) => {
  return await makeRequest(`/loans/${loanId}/guarantors`);
};

const getLoanReferees = async (loanId) => {
  return await makeRequest(`/loans/${loanId}/referees`);
};

const respondToRefereeRequest = async (refereeId, action, reason = '') => {
  return await makeRequest(`/loans/referees/${refereeId}/respond`, {
    method: 'POST',
    body: { refereeId, action, reason },
  });
};

const getRefereeRequests = async (userId) => {
  return await makeRequest(`/loans/referee-requests?userId=${userId}`);
};

const getLoanFines = async (loanId) => {
  return await makeRequest(`/loans/${loanId}/fines`);
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

const initiateLoanApproval = async (loanId, comment) => {
  return await makeRequest(`/loans/${loanId}/approve`, {
    method: 'POST',
    body: { comment },
  });
};

const confirmLoanApproval = async (loanId, otp, comment) => {
  return await makeRequest(`/loans/${loanId}/approve/confirm`, {
    method: 'POST',
    body: { otp, comment },
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

const getLoanRepaymentHistory = async (loanId) => {
  return await makeRequest(`/loans/${loanId}/repayment-history`);
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
  getLoanGuarantors,
  getLoanReferees,
  respondToRefereeRequest,
  getRefereeRequests,
  getLoanFines,
  rejectLoan,
  disburseLoan,
  getLoanTypes,
  getLoanType,
  createLoanType,
  updateLoanType,
  deleteLoanType,
  getLoanRepaymentHistory,
  initiateLoanApproval,
  confirmLoanApproval,
};