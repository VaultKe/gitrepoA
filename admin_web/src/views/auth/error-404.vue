<template>
  <AuthLayout>
    <b-col lg="4" class="mx-auto">
      <b-card no-body>
        <b-card-body class="p-0 bg-black auth-header-box rounded-top">
          <div class="text-center p-3">
            <router-link to="/" class="logo logo-admin">
              <img :src="logoSm" height="50" alt="logo" class="auth-logo" />
            </router-link>
            <h4 class="mt-3 mb-1 fw-semibold text-white fs-18">
              Oops! Sorry page does not found
            </h4>
            <p class="text-muted fw-medium mb-0">Back to dashboard of Rizz</p>
          </div>
        </b-card-body>
        <b-card-body class="pt-0">
          <div class="ex-page-content text-center">
            <img :src="error" alt="0" class="" height="170" />
            <h1 class="my-2">404!</h1>
            <h5 class="fs-16 text-muted mb-3">Somthing went wrong</h5>
          </div>
          <router-link class="btn btn-primary w-100" to="/"
            >Back to Dashboard <i class="fas fa-redo ms-1"></i
          ></router-link>
        </b-card-body>
      </b-card>
    </b-col>
  </AuthLayout>
</template>
<script setup lang="ts">
import logoSm from "@/assets/images/demulla.jpeg";
import error from "@/assets/images/extra/error.svg";

import AuthLayout from "@/layouts/AuthLayout.vue";
</script>
