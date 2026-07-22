import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async fetchFraud(page) {
    try {
      const response = await http().get(`loans/frauds/${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
