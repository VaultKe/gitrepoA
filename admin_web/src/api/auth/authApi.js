import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";

export default {
  async loginApi(data) {
    try {
      const response = await http().post("auth/authenticate", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response?.data || error.message);
    }
  },

  async setup2FAApi(data) {
    try {
      const response = await http().post("auth/2fa/setup", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response?.data || error.message);
    }
  },

  async verify2FAApi(data) {
    try {
      const response = await http().post("auth/2fa/verify", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response?.data || error.message);
    }
  },

  async forgotPasswordApi(data) {
    try {
      const response = await http().post("auth/password/forgot", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response?.data || error.message);
    }
  },

  async resetPasswordApi(data) {
    try {
      const response = await http().post("auth/password/reset", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response?.data || error.message);
    }
  },

  async logoutApi() {
    try {
      const response = await http().post("auth/logout");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response?.data || error.message);
    }
  },

  async meApi() {
    try {
      const response = await http().get("auth/me");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response?.data || error.message);
    }
  },
};
