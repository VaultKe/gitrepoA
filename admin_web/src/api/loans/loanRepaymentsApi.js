import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async fetchActiveLoanAccounts(page = 0, status = "") {
    try {
      const response = await http().get(`loans/loan-repayment?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchActiveLoanAccount(id) {
    try {
      const response = await http().get(`loans/loan-repayment/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createLoanRepayment(data) {
    try {
      const response = await http().post("loans/loan-repayment", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createHangingPayment(data) {
    try {
      const response = await http().post("loans/stray-payments", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchHangingPayments(page = 0, params = {}) {
    try {
      const response = await http().get(`loans/stray-payments?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // reconcile-loan
  async reconcileLoan(data) {
    try {
      const response = await http().post("loans/reconcile-loan", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchHangingPayment(id) {
    try {
      const response = await http().get(`loans/stray-payments/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async paymentLookup(data) {
    try {
      const response = await http().post("loans/manual-settlements", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async paymentAssignment(data) {
    try {
      const response = await http().patch(
        `loans/manual-settlements/${data.payment_id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async queryPaymentLookup(id) {
    try {
      const response = await http().post(`loans/manual-settlements/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchFraud(page, params = {}) {
    try {
      const response = await http().get(`loans/frauds?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async downloadFraud(params) {
    try {
      const response = await http().get(`loans/frauds/download`, { params });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async initiatePaymentTransfer(data) {
    try {
      const response = await http().post(`loans/loan-payment-transfer`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchPaymentTransfers(page = 1, params = {}) {
    try {
      const response = await http().get(
        `loans/loan-payment-transfer?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchPaymentTransfer(id) {
    try {
      const response = await http().get(`loans/loan-payment-transfer/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async submitPaymentTransferApproval(data) {
    try {
      const response = await http().post(
        `loans/loan-payment-transfer-approval`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
