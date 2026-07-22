import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async fetchLoanAccounts(page = 0, params = {}) {
    try {
      const response = await http().get(
        `loans/loan-applications?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLoans(page = 0, params = {}) {
    try {
      const response = await http().get(`loans/loans?page=${page}`, { params });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  //deleteLoanAccount
  async deleteLoanAccount(id) {
    try {
      const response = await http().delete(`loans/loans/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  //updateLoanAccount
  async updateLoanAccount(data) {
    try {
      const response = await http().patch(
        `loans/loans/${data.loan_account_id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchRepaidLoanAccounts(page = 0) {
    try {
      const response = await http().get(`loans/repaid-loans?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchAllLoanAccounts(page = 0, params = {}) {
    try {
      const response = await http().get(`loans/all-loans?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchOverdueLoanAccounts(page = 0) {
    try {
      const response = await http().get(`loans/overdue-loans?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchDelinquentLoanAccounts(page = 0) {
    try {
      const response = await http().get(`loans/delinquent-loans?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchDefaultedLoanAccounts(page = 0) {
    try {
      const response = await http().get(`loans/defaulted-loans?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchFirstTimeLoanAccounts(page = 0) {
    try {
      const response = await http().get(`loans/first-time-loans?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchRestructuredLoanAccounts(page = 0) {
    try {
      const response = await http().get(
        `loans/restructured-loans?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLoanAccount(id) {
    try {
      const response = await http().get(`loans/loan-applications/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async loanAccountDisbursement(data) {
    try {
      const response = await http().post(`loans/disbursement`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async retryAccountDisbursement(data) {
    try {
      const response = await http().post(`loans/retry-disbursement`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async restructureLoan(data) {
    try {
      const response = await http().post(`loans/restructure-loans`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchCustomerWithActiveLoans(page = 0, params = {}) {
    try {
      const response = await http().get(
        `loans/customer-with-active-loans?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
