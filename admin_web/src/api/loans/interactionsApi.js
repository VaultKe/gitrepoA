//     const response = await axios.get('/api/loan-basket-interactions', {
//     params: {
//         customer_id: filters.customer_id,
//         loan_account_id: filters.loan_account_id,
//         loan_basket_id: filters.loan_basket_id,
//         interaction_type_id: filters.interaction_type_id,
//         start_date: filters.start_date, // optional
//         end_date: filters.end_date      // optional
//     }
// });

import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async fetchInteractionTypes() {
    try {
      const response = await http().get(`interactions/types`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createInteractionType(data) {
    try {
      const response = await http().post(`interactions/types`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateInteractionType(data) {
    try {
      const response = await http().patch(
        `interactions/types/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteInteractionType(id) {
    try {
      const response = await http().delete(`interactions/types/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchCustomerInteractions(page = 0, params = {}) {
    try {
      const response = await http().get(
        `interactions/customer-interactions?page=${page}`,
        {
          params,
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchCustomerInteraction(id) {
    try {
      const response = await http().get(
        `interactions/customer-interactions/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async createCustomerInteraction(data) {
    try {
      const response = await http().post(
        `interactions/customer-interactions`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateCustomerInteraction(data) {
    try {
      const response = await http().patch(
        `interactions/customer-interactions/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteCustomerInteraction(id) {
    try {
      const response = await http().delete(
        `interactions/customer-interactions/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
