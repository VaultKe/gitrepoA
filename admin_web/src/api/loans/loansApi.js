import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async fetchLoanRequests(page = 0, params = {}) {
    try {
      const response = await http().get(`loans/loan-request?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchUnattendedLoanRequests(page = 0, params = {}) {
    try {
      const response = await http().get(`loans/loan-request?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // handle-unattended-request
  async unattendedLoanRequest(data) {
    try {
      const response = await http().patch(
        `loans/handle-unattended-request/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchDeclinedLoanRequests(page = 0, params = {}) {
    try {
      const response = await http().get(`loans/loan-requests?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchLoanRequest(id) {
    try {
      const response = await http().get(`loans/loan-request/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async revokeLoanRequestBooking(id, params = {}) {
    try {
      const response = await http().get(`loans/loan-requests/${id}/edit`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async createLoanRequest(data) {
    try {
      const response = await http().post("loans/loan-request", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async approveLoanRequest(data, config) {
    try {
      const response = await http().post("loans/loan-approval", data, config);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createLoanRequestOTP(data) {
    try {
      const response = await http().post("loans/loan-request-otp", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async bookApprovalLoanRequest(id) {
    try {
      const response = await http().patch(`loans/loan-requests/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async resubmitRejectedLoanRequest(data) {
    try {
      const response = await http().patch(
        `loans/loan-request/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchPaymentApprovals(page = 0, params) {
    try {
      const response = await http().get(
        `loans/loan-payment-approval?page=${page}`,
        {
          params,
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchPayment(id) {
    try {
      const response = await http().get(`loans/loan-payment-approval/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async savePaymentApproval(data) {
    try {
      const response = await http().post(`loans/loan-payment-approval`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async closeLoanRequest(data) {
    try {
      const response = await http().post(`loans/loan-request/${data.id}`, {
        response: data.response,
        _method: "DELETE",
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  //download/loan-request/reports
  async downloadLoanRequests(params = {}) {
    try {
      const response = await http().get(`loans/download/loan-request/reports`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
