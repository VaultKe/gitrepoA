import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async fetchLoanRestructureRequests(page = 0, params = {}) {
    try {
      const response = await http().get(`loans/loan-restructure?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLoanRestructureRequest(id) {
    try {
      const response = await http().get(`loans/loan-restructure/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async submitLoanRestructureApproval(data) {
    try {
      const response = await http().post(
        `loans/loan-restructure-approval`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
