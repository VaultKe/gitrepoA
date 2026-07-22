import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";

export default {
  async fetchBasicDashboard() {
    try {
      const response = await http().get(`dashboards/basic`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
