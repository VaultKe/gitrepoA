import http from "../http";
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
  async fetchReportsMeta(scope = "") {
    try {
      const response = await http().get(`reports/sectors-meta?scope=${scope}`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // otc-reports
  async fetchOTCReports(page, params = {}) {
    try {
      const response = await http().get(`reports/otc-reports?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  // mtdc-reports
  async fetchMTDCReports(page, params = {}) {
    try {
      const response = await http().get(`reports/mtdc-reports?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // first time loans reports
  async fetchFirstTimeLoanReports(page, params = {}) {
    try {
      const response = await http().get(
        `reports/first-loans-reports?page=${page}`,
        {
          params,
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // disbursement reports
  async fetchDisbursementReports(page, params = {}) {
    try {
      const response = await http().get(
        `reports/disbursement-reports?page=${page}`,
        {
          params,
        }
      );
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async downloadDisbursementReports(params = {}) {
    try {
      const response = await http().get(`reports/downloads/disbursement`, {
        params,
        // responseType: "blob",
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async downloadMTDCReports(params = {}) {
    try {
      const response = await http().get(`reports/downloads/mtdc`, {
        params,
        // responseType: "blob",
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async downloadOTCReports(params = {}) {
    try {
      const response = await http().get(`reports/downloads/otc`, {
        params,
        // responseType: "blob",
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchReports(params = {}) {
    try {
      const response = await http().get(`reports/active-loans-report`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async downloadReports(params = {}, fileName = "report.xlsx") {
    try {
      const response = await http().get(`reports/active-loans-report/create`, {
        params,
        responseType: "blob", // 🔥 This is crucial for binary file downloads
      });
      const blob = new Blob([response.data], {
        type: response.headers["content-type"],
      });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `${fileName}`;
      link.click();
      link.remove();
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchInteractionsReports(params = {}) {
    try {
      const response = await http().get(`reports/interactions-report`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchRecoveryReports(params = {}) {
    try {
      const response = await http().get(`reports/loans-recovery-report`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async fetchCustomerCounts() {
    //customer-count
    try {
      const response = await http().get(`reports/customer-count`);
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  // Collection reports
  async fetchCollectionReports(page, params = {}) {
    try {
      const response = await http().get(`reports/collections?page=${page}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
  async downloadCollectionsReports(params = {}) {
    try {
      const response = await http().get(`reports/downloads/collections`, {
        params,
        // responseType: "blob",
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },

  async downloadFirstTimeLoanReports(params = {}) {
    try {
      const response = await http().get(`reports/downloads/first-time-loans`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new CustomAxiosError(error.response.data);
    }
  },
};
