import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async fetchModules(page) {
    try {
      const response = await http().get(`settings/system_modules?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchBackup(page) {
    try {
      const response = await http().get(`backup/db?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async generateBackup() {
    try {
      const response = await http().post(`backup/db`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createPermission(data) {
    try {
      const response = await http().post("settings/permissions", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updatePermission(data) {
    try {
      const response = await http().patch(
        `settings/permissions/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deletePermission(id) {
    try {
      const response = await http().delete(`settings/permissions/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchPermissions(page) {
    try {
      const response = await http().get(`settings/permissions?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchRoles(page = 0) {
    try {
      const response = await http().get(`settings/roles?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async saveRole(data) {
    try {
      const response = await http().post(`settings/roles`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateRole(data) {
    try {
      const response = await http().patch(`settings/roles/${data.id}`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchRole(id) {
    try {
      const response = await http().get(`settings/roles/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async downloadRole(params = {}) {
    try {
      const response = await http().get(`settings/download/roles`, { params });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteRole(id) {
    try {
      const response = await http().delete(`settings/roles/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchRolesPermissions(page) {
    try {
      const response = await http().get(`settings/role-permissions`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async assignPermission(data) {
    try {
      const response = await http().post(`settings/role-permissions`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async revokePermission(data) {
    try {
      const response = await http().patch(
        `settings/role-permissions/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLogs(page, data) {
    try {
      const response = await http().post(`settings/logs?page=${page}`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSystemModels() {
    try {
      const response = await http().get("settings/models");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchInteractionTypes() {
    try {
      const response = await http().get("interactions/types");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchInteractionCategories() {
    try {
      const response = await http().get("interactions/interaction-categories");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
