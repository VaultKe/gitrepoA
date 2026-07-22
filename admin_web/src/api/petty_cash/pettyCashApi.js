import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  /**
   *
   * Payment Category
   *
   *
   * **/
  async fetchPaymentCategory(page = 0) {
    try {
      const response = await http().get(
        `ledger-account-flows/payment-category?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async savePaymentCategory(data) {
    try {
      const response = await http().post(
        "ledger-account-flows/payment-category",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updatePaymentCategory(data) {
    try {
      const response = await http().patch(
        `ledger-account-flows/payment-category/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deletePaymentCategory(id) {
    try {
      const response = await http().delete(
        `ledger-account-flows/payment-category/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  /***
   *
   *
   * Petty Cash
   */
  async fetchPettyCash(page = 0, params = {}) {
    try {
      const response = await http().get(
        `ledger-account-flows/petty-cash?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async savePettyCash(data) {
    try {
      const response = await http().post(
        "ledger-account-flows/petty-cash",
        data,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updatePettyCash(data) {
    try {
      const response = await http().patch(
        `ledger-account-flows/petty-cash/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deletePettyCash(id) {
    try {
      const response = await http().delete(
        `ledger-account-flows/petty-cash/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchPettyCashById(id) {
    try {
      const response = await http().get(
        `ledger-account-flows/petty-cash/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  /**
   *
   * Petty Cash Approval || petty-cash-approval
   */

  async createPettyCashApproval(data) {
    try {
      const response = await http().post(
        "ledger-account-flows/petty-cash-approval",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async downloadPettyCashReports(params = {}) {
    try {
      const response = await http().get(`reports/downloads/petty-cash`, {
        params,
        // responseType: "blob",
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
