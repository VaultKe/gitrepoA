import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  /**
   *
   *
   * Demand Letter APIs
   *
   *
   */
  async fetchDemandCustomersApi(params = {}) {
    try {
      const response = await http().get(`repossession/demand-customers`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createDemandLetterApi(data) {
    try {
      const response = await http().post("repossession/demand-letter", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async saveRepossessionEntry(data) {
    try {
      const response = await http().post(
        "repossession/repossession-entry",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchDemandLetterApi(id) {
    try {
      const response = await http().get(`repossession/demand-letter/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async notifyDemandLetterApi(id) {
    try {
      const response = await http().patch(
        `repossession/demand-letter/${id}`,
        {}
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchDemandLettersApi(page = 1, params = {}) {
    try {
      const response = await http().get(
        `repossession/demand-letter?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  /**
   *
   * Repossession APIs
   *
   *
   */

  async fetchRepossessionsApi(page = 1, params = {}) {
    try {
      const response = await http().get(
        `repossession/repossession?page=${page}`,
        {
          params,
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchRepossessionApi(id) {
    try {
      const response = await http().get(`repossession/repossession/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createRepossessionApi(data) {
    try {
      const response = await http().post("repossession/repossession", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchRepossessionReasonsApi() {
    try {
      const response = await http().get(`repossession/repossession-reason`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createRepossessionReasonApi(data) {
    try {
      const response = await http().post(
        "repossession/repossession-reason",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async submitRepossessionForApprovalApi(data) {
    try {
      const response = await http().post(
        `repossession/repossession-approval`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSaleNoticeApi(page, params = {}) {
    try {
      const response = await http().get(
        `repossession/sale-notice?page=${page}`,
        {
          params,
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSaleNoticeByIdApi(id) {
    try {
      const response = await http().get(`repossession/sale-notice/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async submitSaleNoticeForApprovalApi(data) {
    try {
      const response = await http().post(
        `repossession/sale-notice-approval`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
