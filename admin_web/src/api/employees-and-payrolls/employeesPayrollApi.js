import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  // Departments
  async createDepartment(data) {
    try {
      const response = await http().post("employees/departments", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchDepartments(page = 0) {
    try {
      const response = await http().get(`employees/departments?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateDepartment(data) {
    try {
      const response = await http().patch(
        `employees/departments/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchDepartment(id) {
    try {
      const response = await http().get(`employees/departments/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteDepartment(id) {
    try {
      const response = await http().delete(`employees/departments/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // Allowances
  async createAllowance(data) {
    try {
      const response = await http().post("employees/allowances", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchAllowances(page = 0) {
    try {
      const response = await http().get(`employees/allowances?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateAllowance(data) {
    try {
      const response = await http().patch(
        `employees/allowances/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchAllowance(id) {
    try {
      const response = await http().get(`employees/allowances/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteAllowance(id) {
    try {
      const response = await http().delete(`employees/allowances/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // Contact persons
  async createContactPerson(data) {
    try {
      const response = await http().post("employees/contact-persons", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchContactPersons(page = 0) {
    try {
      const response = await http().get("employees/contact-persons");
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateContactPerson(data) {
    try {
      const response = await http().patch(
        `employees/contact-persons/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchContactPerson(id) {
    try {
      const response = await http().get(`employees/contact-persons/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteContactPerson(id) {
    try {
      const response = await http().delete(`employees/contact-persons/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // Deductions
  async createDeduction(data) {
    try {
      const response = await http().post("employees/deductions", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchDeductions(page = 0) {
    try {
      const response = await http().get(`employees/deductions?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateDeduction(data) {
    try {
      const response = await http().patch(
        `employees/deductions/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchDeduction(id) {
    try {
      const response = await http().get(`employees/deductions/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteDeduction(id) {
    try {
      const response = await http().delete(`employees/deductions/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // job types
  async createJobType(data) {
    try {
      const response = await http().post("employees/job-types", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchJobTypes(page = 0) {
    try {
      const response = await http().get(`employees/job-types?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateJobType(data) {
    try {
      const response = await http().patch(
        `employees/job-types/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchJobType(id) {
    try {
      const response = await http().get(`employees/job-types/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteJobType(id) {
    try {
      const response = await http().delete(`employees/job-types/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // employee allowances
  async createEmployeeAllowance(data) {
    try {
      const response = await http().post("employees/employee-allowance", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeeAllowances(page = 0, params = {}) {
    try {
      const response = await http().get(
        `employees/employee-allowance?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateEmployeeAllowance(data) {
    try {
      const response = await http().patch(
        `employees/employee-allowance/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeeAllowance(id) {
    try {
      const response = await http().get(`employees/employee-allowance/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteEmployeeAllowance(id) {
    try {
      const response = await http().delete(
        `employees/employee-allowance/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // employee bank details
  async createEmployeeBankDetail(data) {
    try {
      const response = await http().post("employees/employee-bank", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeeBankDetails(page = 0) {
    try {
      const response = await http().get(`employees/employee-bank?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateEmployeeBankDetail(data) {
    try {
      const response = await http().patch(
        `employees/employee-bank/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeeBankDetail(id) {
    try {
      const response = await http().get(`employees/employee-bank/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteEmployeeBankDetail(id) {
    try {
      const response = await http().delete(`employees/employee-bank/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // employee contact persons
  async createEmployeeContactPerson(data) {
    try {
      const response = await http().post(
        "employees/employee-contact-person",
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeeContactPersons(page = 0) {
    try {
      const response = await http().get(
        `employees/employee-contact-person?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateEmployeeContactPerson(data) {
    try {
      const response = await http().patch(
        `employees/employee-contact-person/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeeContactPerson(id) {
    try {
      const response = await http().get(
        `employees/employee-contact-person/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteEmployeeContactPerson(id) {
    try {
      const response = await http().delete(
        `employees/employee-contact-person/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // employee deductions
  async createEmployeeDeduction(data) {
    try {
      const response = await http().post("employees/employee-deduction", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeeDeductions(page = 0, params = {}) {
    try {
      const response = await http().get(
        `employees/employee-deduction?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateEmployeeDeduction(data) {
    try {
      const response = await http().patch(
        `employees/employee-deduction/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeeDeduction(id) {
    try {
      const response = await http().get(`employees/employee-deduction/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteEmployeeDeduction(id) {
    try {
      const response = await http().delete(
        `employees/employee-deduction/${id}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // employee details
  async createEmployeeDetail(data) {
    try {
      const response = await http().post("employees/employee-details", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeeDetails(page = 0, params = {}) {
    try {
      const response = await http().get(
        `employees/employee-details?page=${page}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateEmployeeDetail(data) {
    try {
      const response = await http().patch(
        `employees/employee-details/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeeDetail(id) {
    try {
      const response = await http().get(`employees/employee-details/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteEmployeeDetail(id) {
    try {
      const response = await http().delete(`employees/employee-details/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // employee salary
  async createEmployeeSalary(data) {
    try {
      const response = await http().post("employees/employee-salary", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeeSalaries(page = 0) {
    try {
      const response = await http().get(
        `employees/employee-salary?page=${page}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateEmployeeSalary(data) {
    try {
      const response = await http().patch(
        `employees/employee-salary/${data.id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeeSalary(id) {
    try {
      const response = await http().get(`employees/employee-salary/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteEmployeeSalary(id) {
    try {
      const response = await http().delete(`employees/employee-salary/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Payroll
  async createEmployeePayroll(data) {
    try {
      const response = await http().post("employees/payroll", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeePayrolls(page = 0, filter = "") {
    try {
      const response = await http().get(
        `employees/payroll?page=${page}&filter=${filter}`
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async updateEmployeePayroll(data) {
    try {
      const response = await http().patch(`employees/payroll/${data.id}`, data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeePayroll(id) {
    try {
      const response = await http().get(`employees/payroll/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async deleteEmployeePayroll(id) {
    try {
      const response = await http().delete(`employees/payroll/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Approve Employee
  async createEmployeeApproval(data) {
    try {
      const response = await http().post("employees/approve", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeeApproval(page = 0) {
    try {
      const response = await http().get(`employees/approve?page=${page}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Can Use Portal
  async createEmployeePortalUsage(data) {
    try {
      const response = await http().post("employees/can-use-portal", data);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async fetchEmployeePortalUsage() {
    try {
      const response = await http().get(`employees/can-use-portal`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // create employee action
  async createEmployeeAction(data) {
    try {
      const response = await http().post(`employees/employee-action`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async deactivateEmployee(id) {
    try {
      const response = await http().patch(`employees/deactivate/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // resend-qtns-link/
  async resendQtnsLink(id) {
    try {
      const response = await http().patch(`employees/resend-qtns-link/${id}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
