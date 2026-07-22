import http from "../http"
import { CustomAxiosError } from "../../helpers/customErrors";

export default {

    async uploadProfile(data) {
        try {
            const response = await http().post(`profile/avatar`, data, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            return response.data
        } catch (error) {
            throw new CustomAxiosError(error.response.data);
        }
    },

}