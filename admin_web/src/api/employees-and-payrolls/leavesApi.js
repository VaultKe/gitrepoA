import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";

export default {
  // Leave Types
  async createLeaveType(data) {
    try {
      const response = await http().post(`employees/leave-types`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLeaveTypes() {
    try {
      const response = await http().get(`employees/leave-types`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLeaveType(id) {
    try {
      const response = await http().get(`employees/leave-types/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateLeaveType(data) {
    try {
      const response = await http().patch(
        `employees/leave-types/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteLeaveType(id) {
    try {
      const response = await http().delete(`employees/leave-types/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Leave Applications

  async createLeave(data) {
    try {
      const response = await http().post(`employees/leaves`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLeaves() {
    try {
      const response = await http().get(`employees/leaves`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLeave(id) {
    try {
      const response = await http().get(`employees/leaves/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateLeave(data) {
    try {
      const response = await http().patch(`employees/leaves/${data.id}`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteLeave(id) {
    try {
      const response = await http().delete(`employees/leaves/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Public holidays
  async createPublicHoliday(data) {
    try {
      const response = await http().post(`employees/public-holidays`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchPublicHolidays() {
    try {
      const response = await http().get(`employees/public-holidays`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchPublicHoliday(id) {
    try {
      const response = await http().get(`employees/public-holidays/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updatePublicHoliday(data) {
    try {
      const response = await http().patch(
        `employees/public-holidays/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deletePublicHoliday(id) {
    try {
      const response = await http().delete(`employees/public-holidays/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchLeaveMetadata(start_date, requested_days) {
    try {
      const response = await http().get(
        `employees/public-holidays/1?start_date=${start_date}&requested_days=${requested_days}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
