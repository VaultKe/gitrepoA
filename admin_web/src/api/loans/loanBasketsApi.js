import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async fetchBasketTypes() {
    try {
      const response = await http().get(`loans/basket-types`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchWriteoffCategories() {
    try {
      const response = await http().get(`loans/write-off-categories`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchBaskets(page = 0, params) {
    try {
      const response = await http().get(`loans/baskets?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchWriteoffBaskets(page = 0, params) {
    try {
      const response = await http().get(`loans/write-offs?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchBasket(id) {
    try {
      const response = await http().get(`loans/baskets/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async assignBasket(data) {
    try {
      const response = await http().post(`loans/baskets`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateBasket(data) {
    try {
      const response = await http().patch(`loans/baskets/${data.id}`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async bulkWriteOffBasket(data) {
    try {
      const response = await http().post(`loans/bulk-write-off`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async submitWriteoffApproval(data) {
    try {
      const response = await http().post(`loans/write-offs`, data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Stats
  async fetchBasketTotalDue(params = {}) {
    try {
      const response = await http().get(`stats/baskets/total-due`, { params });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchBasketTotalCollected(params = {}) {
    try {
      const response = await http().get(`stats/baskets/total-collected`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchBasketTotalBalance(params = {}) {
    try {
      const response = await http().get(`stats/baskets/total-balance`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchBasketTotalPTP(params = {}) {
    try {
      const response = await http().get(`stats/baskets/total-ptp`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchBasketRecoveryAnalysis(params = {}) {
    try {
      const response = await http().get(`stats/baskets/recovery-analysis`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchBasketInteractionAnalysis(params = {}) {
    try {
      const response = await http().get(`stats/baskets/interaction-analysis`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchBasketOvertimeAnalysis(params = {}) {
    try {
      const response = await http().get(`stats/baskets/overtime-analysis`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async downloadBasketsReport(params) {
    // baskets/download
    try {
      const response = await http().get(`loans/basket/download/reports`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
