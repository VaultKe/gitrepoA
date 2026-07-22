import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async getTickets(page = 1, params = {}) {
    try {
      const response = await http().get(`support/tickets?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async getTicket(id) {
    try {
      const response = await http().get(`support/tickets/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createTicket(data) {
    try {
      const response = await http().post(`support/tickets`, data, {
        headers: {
          "content-type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async editTicket(data, id) {
    try {
      const response = await http().patch(`support/tickets`, data, {
        headers: {
          "content-type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateTicket(data, id) {
    try {
      const response = await http().patch(`support/tickets/${id}`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createTicketInteraction(data) {
    try {
      const response = await http().post(`support/ticket-interaction`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async addTagsInteraction(data, id) {
    try {
      const response = await http().patch(
        `support/ticket-interaction/${id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async getTicketAnalytics(params = {}) {
    try {
      const response = await http().get(`support/analytics`, { params });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createSprint(data) {
    try {
      const response = await http().post(`support/sprints`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSprints(page = 1, params = {}) {
    try {
      const response = await http().get(`support/sprints?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSprint(id) {
    try {
      const response = await http().get(`support/sprints/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createEpic(data) {
    try {
      const response = await http().post(`support/epics`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchEpics() {
    try {
      const response = await http().get(`support/epics`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // move-to-active-sprint
  async moveToActiveSprint(id) {
    try {
      const response = await http().patch(
        `support/move-to-active-sprint/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
