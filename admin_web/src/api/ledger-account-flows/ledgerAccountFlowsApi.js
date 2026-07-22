import { CustomAxiosError } from "../../helpers/customErrors";
import http from "../http";

export default {
  // Transaction Types
  async fetchTransactionTypes(page = 0) {
    try {
      const response = await http().get(
        `ledger-account-flows/transaction-types?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createTransactionType(data) {
    try {
      const response = await http().post(
        "ledger-account-flows/transaction-types",
        data
      );
      return response.data;
    } catch (error) {
      console.log("Error", error);
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateTransactionType(data) {
    try {
      const response = await http().patch(
        `ledger-account-flows/transaction-types/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchTransactionType(id) {
    try {
      const response = await http().get(
        `ledger-account-flows/transaction-types/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteTransactionType(id) {
    try {
      const response = await http().delete(
        `ledger-account-flows/transaction-types/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Ledger Categories
  async createLedgerCategory(data) {
    try {
      const response = await http().post(
        "ledger-account-flows/categories",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLedgerCategories(page = 0, params = {}) {
    try {
      const response = await http().get(
        `ledger-account-flows/categories?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateLedgerCategory(data) {
    try {
      const response = await http().patch(
        `ledger-account-flows/categories/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteLedgerCategory(id) {
    try {
      const response = await http().delete(
        `ledger-account-flows/categories/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Ledger Sub categories
  async createLedgerSubCategory(data) {
    try {
      const response = await http().post(
        "ledger-account-flows/sub-categories",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLedgerSubCategories(page = 0) {
    try {
      const response = await http().get(
        `ledger-account-flows/sub-categories?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateLedgerSubCategory(data) {
    try {
      const response = await http().patch(
        `ledger-account-flows/sub-categories/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteLedgerSubCategory(id) {
    try {
      const response = await http().delete(
        `ledger-account-flows/sub-categories/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Ledger Accounts
  async createLedgerAccount(data) {
    try {
      const response = await http().post(
        "ledger-account-flows/ledger-account",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLedgerAccounts(page = 0) {
    try {
      const response = await http().get(
        `ledger-account-flows/ledger-account?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLedgerAccount(id, page) {
    try {
      const response = await http().get(
        `ledger-account-flows/ledger-account/${id}?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateLedgerAccount(data) {
    try {
      const response = await http().patch(
        `ledger-account-flows/ledger-account/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteLedgerAccount(id) {
    try {
      const response = await http().delete(
        `ledger-account-flows/ledger-account/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // Transaction flows

  async createTransactionFlow(data) {
    try {
      const response = await http().post(
        "ledger-account-flows/transaction-flow",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchTransactionFlows(page = 0) {
    try {
      const response = await http().get(
        `ledger-account-flows/transaction-flow?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchTransactionFlow(id) {
    try {
      const response = await http().get(
        `ledger-account-flows/transaction-flow/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateTransactionFlow(data) {
    try {
      const response = await http().patch(
        `ledger-account-flows/transaction-flow/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteTransactionFlow(id) {
    try {
      const response = await http().delete(
        `ledger-account-flows/transaction-flow/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Payment category
  async createPaymentCategory(data) {
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

  async fetchPaymentCategories(page = 0) {
    try {
      const response = await http().get(
        `ledger-account-flows/payment-category?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchPaymentCategory(id) {
    try {
      const response = await http().get(
        `ledger-account-flows/payment-category/${id}`
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
  // Petty cash
  async createPettyCash(data) {
    try {
      const response = await http().post(
        "ledger-account-flows/petty-cash",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchPettyCash(page = 0) {
    try {
      const response = await http().get(
        `ledger-account-flows/petty-cash?page=${page}`
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
  // Supplier
  async createSupplier(data) {
    try {
      const response = await http().post("ledger-account-flows/supplier", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSuppliers(page = 0) {
    try {
      const response = await http().get(
        `ledger-account-flows/supplier?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSupplierById(id) {
    try {
      const response = await http().get(`ledger-account-flows/supplier/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateSupplier(data) {
    try {
      const response = await http().patch(
        `ledger-account-flows/supplier/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteSupplier(id) {
    try {
      const response = await http().delete(
        `ledger-account-flows/supplier/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
