import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async fetchUsersApi() {
    try {
      const response = await http().get("fetch/users");
      return response.data;
    } catch (error) {
      throw new Error(
        error?.response?.data?.message
          ? error.response.data.message
          : error?.message
            ? error.message
            : "Login failed"
      );
    }
  },

  async fetchSystemUsers(page, params = {}) {
    try {
      const response = await http().get(`members/system-users?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSystemUser(id) {
    try {
      const response = await http().get(`members/system-users/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSectorsApi() {
    try {
      const response = await http().get("fetch/sectors");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async onboardEmployeesApi(data) {
    try {
      const response = await http().post("onboard/employees", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateUserRole(data) {
    try {
      const response = await http().patch(
        `members/system-users/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
