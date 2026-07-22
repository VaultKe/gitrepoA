import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async fetchLeadsStats(params = {}) {
    try {
      const response = await http().get("stats/main/leads", { params });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLoanStats(params = {}) {
    try {
      const response = await http().get("stats/main/loan-stats", { params });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchCollections(params = {}) {
    try {
      const response = await http().get("stats/main/collections", { params });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchMTD() {
    try {
      const response = await http().get("stats/main/mtd");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async getAverageOTC() {
    try {
      const response = await http().get("stats/main/average-otc");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async getAverageDaysLate() {
    try {
      const response = await http().get("stats/main/average-days-late");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async getAverageLoanSize() {
    try {
      const response = await http().get("stats/main/average-loan-size");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async getAverageTimeToFirstRepayment() {
    try {
      const response = await http().get("stats/main/average-first-repayment");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async getAverageTAT() {
    try {
      const response = await http().get("stats/main/average-tat");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async getActivePromises() {
    try {
      const response = await http().get("stats/main/active-promises");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async getPAR() {
    try {
      const response = await http().get("stats/main/portfolio-at-risk");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async getChurnRate() {
    try {
      const response = await http().get("stats/main/churn-rate");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async getEarlyDefaultRate() {
    try {
      const response = await http().get("stats/main/early-default-rate");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async getPortfolioSize() {
    try {
      const response = await http().get("stats/main/portfolio-size");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async getValueAtRisk() {
    try {
      const response = await http().get("stats/main/value-at-risk");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchDownloads(page = 1, params = {}) {
    try {
      const response = await http().get(`export/downloads?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async writeOffRatio() {
    try {
      const response = await http().get("stats/main/written-off-ratio");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
