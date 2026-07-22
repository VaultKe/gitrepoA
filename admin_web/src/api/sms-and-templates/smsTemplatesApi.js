import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  // SMS type
  async createSMSType(data) {
    try {
      const response = await http().post("sms/types", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchSMSTypes() {
    try {
      const response = await http().get("sms/types");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createSMSCategory(data) {
    try {
      const response = await http().post("sms/categories", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchSMSCategories(params = {}) {
    try {
      const response = await http().get("sms/categories", { params });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteSMSType(id) {
    try {
      const response = await http().delete(`sms/types/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // SMS template
  async createSMSTemplate(data) {
    try {
      const response = await http().post("sms/templates", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSMSTemplates() {
    try {
      const response = await http().get("sms/templates");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSMSTemplate(id) {
    try {
      const response = await http().get(`sms/templates/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateSMSTemplate(data) {
    try {
      const response = await http().patch(`sms/templates/${data.id}`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteSMSTemplate(id) {
    try {
      const response = await http().delete(`sms/templates/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // Send SMS
  async fetchSentSMS(page, params) {
    try {
      const response = await http().get(`sms/send?page=${page}`, { params });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async SendSMS(data) {
    try {
      const response = await http().post("sms/send", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Sender Ids
  async fetchSenderIds() {
    try {
      const response = await http().get(`sms/sender-ids`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSMSDashboard(params) {
    try {
      const response = await http().get(`sms/sms-dashboard`, { params });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
