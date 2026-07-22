import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async createCustomerFosa(data) {
    try {
      const response = await http().post(
        "customer-fosa/customer-fosa-accounts",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchCustomerFosa(page = 0, params = {}) {
    try {
      const response = await http().get(
        `customer-fosa/customer-fosa-accounts?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchCustomerWallet(id) {
    try {
      const response = await http().get(
        `customer-fosa/customer-fosa-accounts/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateCustomerFosa(data) {
    try {
      const response = await http().patch(
        `customer-fosa/customer-fosa-accounts/${data.customer_id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Savings
  // Deposits
  async createCustomerDeposit(data) {
    try {
      const response = await http().post("savings/customer-deposit", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchCustomerDeposits(page = 0) {
    try {
      const response = await http().get(
        `savings/customer-deposit?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Deposit Requests
  async fetchCustomerDepositRequests(page = 0) {
    try {
      const response = await http().get(`savings/deposit-request?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // Pending Deposits
  async fetchCustomerPendingDeposits(page = 0, query) {
    try {
      const response = await http().get(
        `savings/pending-deposit?page=${page}&query=${query}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Deposit Mpesa Transactions
  async fetchCustomerDepositMpesaTransactions(page = 0) {
    try {
      const response = await http().get(
        `savings/deposit-mpesa-transactions?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // promote
  async promoteDeposit() {
    try {
      const response = await http().post("promote");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async interestDeposit() {
    try {
      const response = await http().post("interest");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createCustomerWalletAction(data) {
    // customer-wallet-action
    try {
      const response = await http().post(
        "customer-fosa/customer-wallet-action",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchCustomerWalletActions(page = 1, params = {}) {
    try {
      const response = await http().get(
        `customer-fosa/customer-wallet-action?page=${page}`,
        {
          params,
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchWalletAction(id) {
    try {
      const response = await http().get(
        `customer-fosa/customer-wallet-action/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createCustomerActionApproval(data) {
    try {
      const response = await http().post(
        "customer-fosa/customer-wallet-action-approval",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
