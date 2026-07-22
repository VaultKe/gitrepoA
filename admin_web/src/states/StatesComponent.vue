<template>
  <div>
    <div v-if="apiState.success" class="alert alert-success py-1 px-1" role="alert">
      <p class="px-0 py-0">{{ apiState.message }}</p>
    </div>
    <div v-if="apiState.saving" class="alert alert-info py-1 px-1" role="alert">
      <span class="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span>
      Processing...
    </div>
    <div v-if="apiState.loading" class="alert alert-info py-1 px-1" role="alert">
      <span class="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span>
      Loading...
    </div>
    <div v-if="apiState.error" class="alert alert-danger alert-dismissible fade show py-3" role="alert">
      <strong>Error!</strong> {{ apiState.message }}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
    <div v-if="apiState.errors?.length">
      <ul>
        <li class="text-danger" v-for="err in apiState.errors" :key="err">
          {{ err }}
        </li>
      </ul>
    </div>
    <div v-if="apiState.downloading" class="alert alert-info py-1 px-1" role="alert">
      <span class="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span>
      Downloading...
    </div>
  </div>
</template>

<script setup>
import { watch } from "vue";
import { useApiState } from "@/stores/apiState";
const apiState = useApiState();

watch(
  async () => apiState.success,
  async (current, old) => {
    if (!current) return;
    if (apiState.errors.length) {
      apiState.setErrors([]);
    }
    setTimeout(() => {
      apiState.setSuccess(false);
      apiState.setMessage("");
    }, 3000);
  }
);

watch(
  async () => apiState.error,
  async (current, old) => {
    if (!current) return;
    setTimeout(() => {
      apiState.setError(false);
      apiState.setMessage("");
      if (apiState.errors.length) {
        apiState.setErrors([]);
      }
    }, 9000);
  }
);

watch(
  async () => apiState.loading,
  async (current, old) => {
    if (!current) return;
    if (apiState.success) {
      setTimeout(() => {
        apiState.setSuccess(false);
        apiState.setMessage("");
      }, 3000)
    }
  }
);

watch(
  async () => apiState.downloading,
  async (current, old) => {
    if (!current) return;
    if (apiState.downloading) {
      setTimeout(async () => {
        apiState.setDownloading(false);
        apiState.setMessage("");
      }, 3000);
    }
  }
);
</script>