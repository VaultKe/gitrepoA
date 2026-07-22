import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async createPromiseToPay(data) {
    try {
      const response = await http().post("loans/promise-to-pay", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async bulkClosePromiseToPay(data) {
    try {
      const response = await http().post("loans/expired-ptp", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchAllPromiseToPay(page = 0) {
    try {
      const response = await http().get(`loans/promise-to-pay?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchPromiseToPay(id) {
    try {
      const response = await http().get(`loans/promise-to-pay/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchActivePromiseToPay(page = 0) {
    try {
      const response = await http().get(`loans/active-ptp?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateActivePromiseToPayStatus(data) {
    try {
      const response = await http().patch(`loans/active-ptp/${data.id}`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchExpiredPromiseToPay(page = 0) {
    try {
      const response = await http().get(`loans/expired-ptp?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
