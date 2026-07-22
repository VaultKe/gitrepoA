// stores/apiState.js
import { defineStore } from 'pinia';
import { ref } from 'vue';

// Pinia store to handle the API states
export const useApiState = defineStore('apiState', () => {
    // States to manage loading, error, success, etc.
    const loading = ref(false);
    const saving = ref(false);
    const error = ref(false);
    const errors = ref([]);
    const downloading = ref(false);
    const success = ref(false);
    const message = ref('');

    // Actions to trigger loading, saving, success, error, etc.
    const setLoading = (state: boolean) => {
        loading.value = state;
    };

    const setSaving = (state: boolean) => {
        saving.value = state;
    };

    const setError = (errorMessage: boolean) => {
        error.value = errorMessage;
    };

    const setSuccess = (state: boolean) => {
        success.value = state;
    };

    const setDownloading = (state: boolean) => {
        downloading.value = state;
    };

    const setMessage = (msg: string) => {
        message.value = msg;
    };


    const setErrors = (err: never[]) => {
        errors.value = err
    }

    // Reset all states
    const resetState = () => {
        loading.value = false;
        saving.value = false;
        error.value = false;
        downloading.value = false;
        success.value = false;
        message.value = '';
        errors.value = []
    };

    return {
        loading,
        saving,
        error,
        success,
        message,
        errors,
        downloading,
        setLoading,
        setSaving,
        setError,
        setErrors,
        setSuccess,
        setMessage,
        setDownloading,
        resetState,
    };
});