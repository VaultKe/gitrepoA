import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async createCustomer(data) {
    try {
      const response = await http().post("customer-management/customers", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  //update-customer-status
  async updateCustomerStatus(data) {
    try {
      const response = await http().post(
        "customer-management/update-customer-status",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateCustomerLoanLimit(data) {
    try {
      const response = await http().post(
        "customer-management/update/loan-limit",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchCustomers(page = 0, params = {}) {
    try {
      const response = await http().get(
        `customer-management/customers?page=${page}`,
        {
          params,
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchSearchCustomers(params = {}) {
    try {
      const response = await http().get(`customer-management/customer-search`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchIncompleteAccounts(page = 0) {
    try {
      const response = await http().get(
        `customer-management/incomplete-accounts?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchCustomerById(id, full = 1) {
    try {
      const response = await http().get(
        `customer-management/customers/${id}?full=${full}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateCustomer(data) {
    try {
      const response = await http().patch(
        `customer-management/customers/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // approve-customer
  async approveCustomer(data) {
    try {
      const response = await http().post(
        `customer-management/approve-customer`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteCustomer(id) {
    try {
      const response = await http().delete(
        `customer-management/customers/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  //customers/{customer}/edit
  async resendCustomerOTP(id) {
    try {
      const response = await http().get(
        `customer-management/customers/${id}/edit`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // customer profile
  async createCustomerProfile(data) {
    try {
      const response = await http().post(
        "customer-management/customer-profiles",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchCustomerProfiles(page = 0, params = {}) {
    try {
      const response = await http().get(
        `customer-management/customer-profiles?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchCustomerProfileById(id) {
    try {
      const response = await http().get(
        `customer-management/customer-profiles/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateCustomerProfile(data) {
    try {
      const response = await http().patch(
        `customer-management/customer-profiles/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteCustomerProfile(id) {
    try {
      const response = await http().delete(
        `customer-management/customer-profiles/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // business type
  async createBusinessType(data) {
    try {
      const response = await http().post(
        "customer-management/business-types",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchBusinessTypes(query = "", page = 0) {
    try {
      const response = await http().get(
        `customer-management/business-types?page=${page}&query=${query}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchBusinessTypeById(id) {
    try {
      const response = await http().get(
        `customer-management/business-types/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateBusinessType(data) {
    try {
      const response = await http().patch(
        `customer-management/business-types/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteBusinessType(id) {
    try {
      const response = await http().delete(
        `customer-management/business-types/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // Tasks types
  async createTaskType() {
    try {
      const response = await http().post(
        "customer-management/task-types",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchTaskTypes(page = 0) {
    try {
      const response = await http().get(
        `customer-management/task-types?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchTaskTypeById(id, page = 0) {
    try {
      const response = await http().get(
        `customer-management/task-types/${id}?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateTaskType(data) {
    try {
      const response = await http().patch(
        `customer-management/task-types/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteTaskType(id) {
    try {
      const response = await http().delete(
        `customer-management/task-types/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // Task assignments
  async createTaskAssignment(data) {
    try {
      const response = await http().post("customer-management/tasks", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchTaskAssignments(page = 0) {
    try {
      const response = await http().get(
        `customer-management/tasks?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchTaskAssignmentById(id) {
    try {
      const response = await http().get(`customer-management/tasks/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateTaskAssignment(data) {
    try {
      const response = await http().patch(
        `customer-management/tasks/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteTaskAssignment(id) {
    try {
      const response = await http().delete(`customer-management/tasks/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // user list
  async fetchUserList() {
    try {
      const response = await http().get(`user-list`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // file types
  async fetchFileTypes() {
    try {
      const response = await http().get(`customer-management/file-types`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Customer Documents
  async createCustomerDocument(data) {
    try {
      const response = await http().post(
        `customer-management/documents`,
        data,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Delete customer document
  async deleteCustomerDocument(id) {
    try {
      const response = await http().delete(
        `customer-management/documents/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Customer Change
  async createCustomerChange(data) {
    try {
      const response = await http().post(
        "customer-management/customer-contact-change",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchCustomerChanges(page = 0, params = {}) {
    try {
      const response = await http().get(
        `customer-management/customer-contact-change?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchCustomerChangeById(id) {
    try {
      const response = await http().get(
        `customer-management/customer-contact-change/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  }, //approve-contact-change
  async updateCustomerChange(data) {
    try {
      const response = await http().patch(
        `customer-management/verify-contact-change/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async approveCustomerChange(data) {
    try {
      const response = await http().patch(
        `customer-management/approve-contact-change/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteCustomerChange(id) {
    try {
      const response = await http().delete(
        `customer-management/customer-contact-change/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchVerifyContactChanges(page = 0, params = {}) {
    try {
      const response = await http().get(
        `customer-management/verify-contact-change?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchApproveContactChanges(page = 0, params = {}) {
    try {
      const response = await http().get(
        `customer-management/approve-contact-change?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Customer Affordability

  // Customer Documents
  async createCustomerDocument(data) {
    try {
      const response = await http().post(
        `customer-management/documents`,
        data,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Customer Change
  async createCustomerAffordability(data) {
    try {
      const response = await http().post(
        "customer-management/affordability-change",
        data,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchCustomerCAffordability(page = 0, params = {}) {
    try {
      const response = await http().get(
        `customer-management/affordability-change?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchCustomerVerifyAffordability(page = 0, params = {}) {
    try {
      const response = await http().get(
        `customer-management/verify-affordability?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchCustomerAffordabilityById(id) {
    try {
      const response = await http().get(
        `customer-management/affordability-change/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateCustomerAffordability(data) {
    try {
      const response = await http().patch(
        `customer-management/affordability-change/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteCustomerAffordability(id) {
    try {
      const response = await http().delete(
        `customer-management/affordability-change/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Verify Customer
  async fetchCustomerVerifications(page = 0, params = {}) {
    try {
      const response = await http().get(
        `customer-management/verify-customer?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async customerVerification(data) {
    try {
      const response = await http().post(
        `customer-management/verify-customer`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // Approve Customer
  async fetchCustomerApprovals(page = 0, params = {}) {
    try {
      const response = await http().get(
        `customer-management/approve-customer?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateCustomerApprovals(data) {
    try {
      const response = await http().patch(
        `customer-management/approve-customer/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // Block Customer
  // Delete Customer
  // Customer leads
  async fetchCustomerLeads(page = 0, params) {
    try {
      const response = await http().get(
        `customer-management/leads?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchCustomerLead(id) {
    try {
      const response = await http().get(`customer-management/leads/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async saveCustomerLeads(data) {
    try {
      const response = await http().post(`customer-management/leads`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async updateCustomerLeads(data) {
    try {
      const response = await http().patch(
        `customer-management/leads/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchCustomerWithActiveLoansNoPTP(page = 0, params = {}) {
    try {
      const response = await http().get(
        `customer-management/initiate-ptp?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  //behavior-dashboard
  async fetchCustomerDashboard(params = {}) {
    try {
      const response = await http().get(
        `customer-management/behavior-dashboard`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  /**
   *
   * Customer referees Apis
   */
  async addReferee(data) {
    try {
      const response = await http().post(`customer-management/referees`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchReferee(id) {
    try {
      const response = await http().get(`customer-management/referees/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateReferee(data) {
    try {
      const response = await http().patch(
        `customer-management/referees/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteReferee(id) {
    try {
      const response = await http().delete(
        `customer-management/referees/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  /**
   *
   * Customer guarantor Apis
   */
  async addGuarantor(data) {
    try {
      const response = await http().post(
        `customer-management/guarantors`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchGuarantor(id) {
    try {
      const response = await http().get(`customer-management/guarantors/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateGuarantor(data) {
    try {
      const response = await http().patch(
        `customer-management/guarantors/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deleteGuarantor(id) {
    try {
      const response = await http().delete(
        `customer-management/guarantors/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // customer-inactive
  async fetchInactiveCustomer(id) {
    try {
      const response = await http().get(
        `customer-management/customer-inactive/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Download customers
  async downloadCustomers(params = {}) {
    try {
      const response = await http().get(
        `customer-management/download/customers`,
        {
          params,
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
