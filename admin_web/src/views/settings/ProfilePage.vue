<template>
    <DefaultLayout>
        <b-row class="justify-content-center">
            <b-col cols="12">
                <!-- Page Header -->
                <div class="mb-4">
                    <h4 class="fw-bold mb-1">Profile Settings</h4>
                    <p class="text-muted mb-0">Manage your account information</p>
                </div>

                <b-row class="g-4">
                    <!-- Profile Information -->
                    <b-col lg="8">
                        <b-card class="border-0 shadow-sm mb-4">
                            <b-card-header class="bg-white border-0">
                                <h5 class="fw-bold mb-0">Personal Information</h5>
                            </b-card-header>
                            <b-card-body>
                                <b-row class="g-3">
                                    <b-col md="6">
                                        <label class="form-label">First Name</label>
                                        <b-form-input value="John" />
                                    </b-col>

                                    <b-col md="6">
                                        <label class="form-label">Last Name</label>
                                        <b-form-input value="Doe" />
                                    </b-col>

                                    <b-col md="6">
                                        <label class="form-label">Email Address</label>
                                        <b-form-input value="odenyothadeus@gmail.com" disabled />
                                        <small class="text-muted">Email cannot be changed</small>
                                    </b-col>

                                    <b-col md="6">
                                        <label class="form-label">Username</label>
                                        <b-form-input value="johndoe" disabled />
                                        <small class="text-muted">Username cannot be changed</small>
                                    </b-col>

                                    <b-col md="6">
                                        <label class="form-label">Phone Number</label>
                                        <b-form-input value="254708374149" />
                                    </b-col>

                                    <b-col md="6">
                                        <label class="form-label">Account Type</label>
                                        <b-form-input value="Developer" disabled />
                                    </b-col>

                                    <b-col cols="12">
                                        <b-button variant="success">
                                            <i class="fas fa-save me-2"></i>Save Changes
                                        </b-button>
                                    </b-col>
                                </b-row>
                            </b-card-body>
                        </b-card>

                        <!-- Change Password -->
                        <b-card class="border-0 shadow-sm">
                            <b-card-header class="bg-white border-0">
                                <h5 class="fw-bold mb-0">Change Password</h5>
                            </b-card-header>
                            <b-card-body>
                                <b-row class="g-3">
                                    <b-col cols="12">
                                        <label class="form-label">Current Password</label>
                                        <b-form-input type="password" />
                                    </b-col>

                                    <b-col md="6">
                                        <label class="form-label">New Password</label>
                                        <b-form-input type="password" />
                                    </b-col>

                                    <b-col md="6">
                                        <label class="form-label">Confirm New Password</label>
                                        <b-form-input type="password" />
                                    </b-col>

                                    <b-col cols="12">
                                        <b-button variant="primary">
                                            <i class="fas fa-key me-2"></i>Update Password
                                        </b-button>
                                    </b-col>
                                </b-row>
                            </b-card-body>
                        </b-card>
                    </b-col>

                    <!-- Profile Summary -->
                    <b-col lg="4">
                        <b-card class="border-0 shadow-sm">
                            <b-card-body class="text-center">
                                <div class="avatar-xl bg-success bg-opacity-10 rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center"
                                    style="width: 100px; height: 100px;">
                                    <i class="fas fa-user text-success" style="font-size: 48px;"></i>
                                </div>
                                <h5 class="fw-bold mb-1">John Doe</h5>
                                <p class="text-muted mb-3">odenyothadeus@gmail.com</p>
                                <span class="badge bg-success-subtle text-success mb-4">Active Account</span>

                                <div class="border-top pt-3">
                                    <div class="d-flex justify-content-between mb-2">
                                        <small class="text-muted">Member Since</small>
                                        <small class="fw-bold">Jan 15, 2026</small>
                                    </div>
                                    <div class="d-flex justify-content-between mb-2">
                                        <small class="text-muted">Total Apps</small>
                                        <small class="fw-bold">3</small>
                                    </div>
                                    <div class="d-flex justify-content-between">
                                        <small class="text-muted">Total Transactions</small>
                                        <small class="fw-bold">12,458</small>
                                    </div>
                                </div>
                            </b-card-body>
                        </b-card>
                    </b-col>
                </b-row>
            </b-col>
        </b-row>
    </DefaultLayout>
</template>

<script setup>
import { onMounted } from "vue";
import DefaultLayout from "@/layouts/DefaultLayout.vue";

onMounted(() => {
    // Future: Load user profile from API
});
</script>