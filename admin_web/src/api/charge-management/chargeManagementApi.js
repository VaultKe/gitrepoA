import { CustomAxiosError } from "../../helpers/customErrors";
import http from "../http"

export default {
    async createCharge(data) {
        try {
            const response = await http().post('charge-management/charge', data);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

    async updateCharge(data) {
        try {
            const response = await http().patch(`charge-management/charge/${data.id}`, data);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

    async fetchCharges(page) {
        try {
            const response = await http().get(`charge-management/charge?page=${page}`);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },


    async fetchChargeById(id) {
        try {
            const response = await http().get(`charge-management/charge/${id}`);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

    async createChargeMap(data) {
        try {
            const response = await http().post('charge-management/charge-maps', data);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

    async updateChargeMap(data) {
        try {
            const response = await http().patch(`charge-management/charge-maps/${data.id}`, data);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

    async deleteChargeMap(id) {
        try {
            const response = await http().delete(`charge-management/charge-maps/${id}`);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

    async fetchChargeMaps(page) {
        try {
            const response = await http().get(`charge-management/charge-maps?page=${page}`);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },
    async fetchChargeMapById(id) {
        try {
            const response = await http().get(`charge-management/charge-maps/${id}`);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    }
}