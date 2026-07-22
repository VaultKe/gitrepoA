import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async saveLoanProduct(data) {
    try {
      const response = await http().post(
        "loan-products-charges/loan-products",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateLoanProduct(data) {
    try {
      const response = await http().patch(
        `loan-products-charges/loan-products/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteLoanProduct(id) {
    try {
      const response = await http().delete(
        `loan-products-charges/loan-products/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLoanProducts(page) {
    try {
      const response = await http().get(
        `loan-products-charges/loan-products?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLoanProduct(id) {
    try {
      const response = await http().get(
        `loan-products-charges/loan-products/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async saveLoanCharge(data) {
    try {
      const response = await http().post(
        "loan-products-charges/loan-charges",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateLoanCharge(data) {
    try {
      const response = await http().patch(
        `loan-products-charges/loan-charges/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteLoanCharge(id) {
    try {
      const response = await http().delete(
        `loan-products-charges/loan-charges/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLoanCharges(page) {
    try {
      const response = await http().get(
        `loan-products-charges/loan-charges?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLoanCharge(id) {
    try {
      const response = await http().get(
        `loan-products-charges/loan-charges/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
