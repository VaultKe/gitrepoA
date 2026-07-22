import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";

export default {
  async fetchTransactions(page = 0, params) {
    try {
      const response = await http().get(`finance/transactions?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchChannelRequests(page = 0, params) {
    try {
      const response = await http().get(
        `finance/channel-requests?page=${page}`,
        {
          params,
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchC2BTransactions(page = 1) {
    try {
      const response = await http().get(
        `finance/c2b-transactions?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchB2CTransactions(page = 1) {
    try {
      const response = await http().get(
        `finance/b2c-transactions?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchDeclinedRequestApi(page = 0, params = {}) {
    try {
      const response = await http().get(`disbursement-attempt?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchTransactionByReceipt(params = {}) {
    // transactions
    try {
      const response = await http().get(`finance/transactions/1`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
