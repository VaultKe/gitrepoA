import http from "../http"
import { CustomAxiosError } from "../../helpers/customErrors";
export default {
    async fetchTransactions(page = 0) {
        try {
            const response = await http().get(`transactions?page=${page}`);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

    async fetchChannelRequests(page = 0) {
        try {
            const response = await http().get(`transactions/channel-requests?page=${page}`);
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },
}