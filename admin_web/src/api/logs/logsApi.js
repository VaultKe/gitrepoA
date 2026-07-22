import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";

export default {
  async fetchGeneralLogs(page = 1, params = {}) {
    try {
      const response = await http().get(`logs/system-logs?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchGeneralLog(id) {
    try {
      const response = await http().get(`logs/system-logs/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSystemLogsMetadata() {
    try {
      const response = await http().get(`logs/system-activity-logs/1`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSystemLogs(page = 1, params = {}) {
    try {
      const response = await http().get(
        `logs/system-activity-logs?page=${page}`,
        {
          params,
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
