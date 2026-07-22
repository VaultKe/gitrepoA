import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";

export default {
  async fetchSectorsWithLoans() {
    try {
      const response = await http().get("stats/metadata");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
