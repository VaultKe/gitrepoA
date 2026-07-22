import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async fetchChecklist(page = 0) {
    try {
      const response = await http().get(
        `checklist/checklists?page=${page}&status=${status}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createChecklist(data) {
    try {
      const response = await http().post(`checklist/checklists`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateChecklistTitle(data) {
    try {
      const response = await http().patch(`checklist/checklists/${data.id}`, {
        title: data.title,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateChecklistItem(data) {
    try {
      const response = await http().patch(`checklist/items/${data.id}`, {
        item: data.item,
        mandatory: data.mandatory,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createChecklistItem(data) {
    try {
      const response = await http().post(`checklist/items`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchChecklistItems(id) {
    try {
      const response = await http().get(`checklist/checklists/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
