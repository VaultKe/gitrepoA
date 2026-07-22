import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async createSector(data) {
    try {
      const response = await http().post("branch-markets/sectors", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSectors(page = 0) {
    try {
      const response = await http().get(`branch-markets/sectors?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSectorById(id) {
    try {
      const response = await http().get(`branch-markets/sectors/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateSector(data) {
    try {
      const response = await http().patch(
        `branch-markets/sectors/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteSector(id) {
    try {
      const response = await http().delete(`branch-markets/sectors/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async createBranch(data) {
    try {
      const response = await http().post("branch-markets/branches", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchBranches(page = 0) {
    try {
      const response = await http().get(`branch-markets/branches?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchBranchById(id) {
    try {
      const response = await http().get(`branch-markets/branches/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateBranch(data) {
    try {
      const response = await http().patch(
        `branch-markets/branches/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteBranch(id) {
    try {
      const response = await http().delete(`branch-markets/branches/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchSubBranches(page = 0) {
    try {
      const response = await http().get(
        `branch-markets/sub-branches?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async createSubBranch(data) {
    try {
      const response = await http().post("branch-markets/sub-branches", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchSubBranchById(id) {
    try {
      const response = await http().get(`branch-markets/sub-branches/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateSubBranch(data) {
    try {
      const response = await http().patch(
        `branch-markets/sub-branches/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteSubBranch(id) {
    try {
      const response = await http().delete(`branch-markets/sub-branches/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchMarkets(page = 0, params = {}) {
    try {
      const response = await http().get(
        `branch-markets/sub-markets?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async createMarket(data) {
    try {
      const response = await http().post(`branch-markets/sub-markets`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchMarketById(id) {
    try {
      const response = await http().get(`branch-markets/sub-markets/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateMarket(data) {
    try {
      const response = await http().patch(
        `branch-markets/sub-markets/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteMarket(id) {
    try {
      const response = await http().delete(`branch-markets/sub-markets/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // exports
  async branchExports(scope, format) {
    try {
      const response = await http().get(
        `branch-markets/exports?scope=${scope}&format=${format}`,
        {
          responseType: "blob", // 🔥 This is crucial for binary file downloads
        }
      );
      const blob = new Blob([response.data], {
        type: response.headers["content-type"],
      });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `${scope}.${format}`;
      link.click();
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
