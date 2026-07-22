import http from "../http"
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
    // Company assets
    async createCompanyAsset(data) {
        try {
            const response = await http().post('assets/company', data);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

    async fetchCompanyAssets(page = 0, query = '') {
        try {
            const response = await http().get(`assets/company?page=${page}&query=${query}`);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

    async fetchCompanyAssetById(id) {
        try {
            const response = await http().get(`assets/company/${id}`);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },
    async updateCompanyAsset(data) {
        try {
            const response = await http().patch(`assets/company/${data.id}`, data);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },
    async deleteCompanyAsset(id) {
        try {
            const response = await http().delete(`assets/company/${id}`);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

    // Customer assets
    async createCustomerAsset(data) {
        try {
            const response = await http().post('assets/customer', data);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

    async fetchCustomerAssets(page = 0, query = '') {
        try {
            const response = await http().get(`assets/customer?page=${page}&query=${query}`);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

    async fetchCustomerAssetById(id) {
        try {
            const response = await http().get(`assets/customer/${id}`);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },
    async updateCustomerAsset(data) {
        try {
            const response = await http().patch(`assets/customer/${data.id}`, data);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },
    async deleteCustomerAsset(id) {
        try {
            const response = await http().delete(`assets/customer/${id}`);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

    // Company assets upload
    async createCompanyAssetUpload(data) {
        try {
            const response = await http().post('assets/company-uploads', data, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

    // Customer assets upload
    async createCustomerAssetUpload(data) {
        try {
            const response = await http().post('assets/customer-uploads', data, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },
}