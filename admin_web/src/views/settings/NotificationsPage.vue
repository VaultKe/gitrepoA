<template>
    <DefaultLayout>
        <b-row class="justify-content-center">
            <b-col cols="12">
                <!-- Page Header -->
                <div class="mb-4">
                    <h4 class="fw-bold mb-1">Notification Settings</h4>
                    <p class="text-muted mb-0">Manage how you receive notifications</p>
                </div>

                <b-row class="g-4">
                    <b-col lg="8">
                        <!-- Email Notifications -->
                        <b-card class="border-0 shadow-sm mb-4">
                            <b-card-header class="bg-white border-0">
                                <h5 class="fw-bold mb-0">Email Notifications</h5>
                            </b-card-header>
                            <b-card-body>
                                <p class="text-muted mb-4">
                                    Choose which email notifications you want to receive
                                </p>

                                <!-- Transaction Notifications -->
                                <div class="mb-4">
                                    <h6 class="fw-bold mb-3">Transaction Notifications</h6>

                                    <div
                                        class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                                        <div>
                                            <div class="fw-bold">Successful Transactions</div>
                                            <small class="text-muted">Receive email when a transaction succeeds</small>
                                        </div>
                                        <b-form-checkbox switch size="lg" checked></b-form-checkbox>
                                    </div>

                                    <div
                                        class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                                        <div>
                                            <div class="fw-bold">Failed Transactions</div>
                                            <small class="text-muted">Receive email when a transaction fails</small>
                                        </div>
                                        <b-form-checkbox switch size="lg" checked></b-form-checkbox>
                                    </div>

                                    <div class="d-flex justify-content-between align-items-center pb-3 border-bottom">
                                        <div>
                                            <div class="fw-bold">Large Transactions</div>
                                            <small class="text-muted">Alert for transactions above KES 10,000</small>
                                        </div>
                                        <b-form-checkbox switch size="lg"></b-form-checkbox>
                                    </div>
                                </div>

                                <!-- System Notifications -->
                                <div class="mb-4">
                                    <h6 class="fw-bold mb-3">System Notifications</h6>

                                    <div
                                        class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                                        <div>
                                            <div class="fw-bold">Webhook Failures</div>
                                            <small class="text-muted">Notify when webhook delivery fails</small>
                                        </div>
                                        <b-form-checkbox switch size="lg" checked></b-form-checkbox>
                                    </div>

                                    <div
                                        class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                                        <div>
                                            <div class="fw-bold">Security Alerts</div>
                                            <small class="text-muted">Login attempts and security events</small>
                                        </div>
                                        <b-form-checkbox switch size="lg" checked></b-form-checkbox>
                                    </div>

                                    <div class="d-flex justify-content-between align-items-center pb-3 border-bottom">
                                        <div>
                                            <div class="fw-bold">API Changes</div>
                                            <small class="text-muted">Updates to API and new features</small>
                                        </div>
                                        <b-form-checkbox switch size="lg" checked></b-form-checkbox>
                                    </div>
                                </div>

                                <!-- Reports -->
                                <div class="mb-4">
                                    <h6 class="fw-bold mb-3">Reports</h6>

                                    <div
                                        class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                                        <div>
                                            <div class="fw-bold">Daily Summary</div>
                                            <small class="text-muted">Daily transaction summary at 8:00 AM</small>
                                        </div>
                                        <b-form-checkbox switch size="lg"></b-form-checkbox>
                                    </div>

                                    <div
                                        class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                                        <div>
                                            <div class="fw-bold">Weekly Report</div>
                                            <small class="text-muted">Weekly performance report every Monday</small>
                                        </div>
                                        <b-form-checkbox switch size="lg" checked></b-form-checkbox>
                                    </div>

                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div class="fw-bold">Monthly Report</div>
                                            <small class="text-muted">Comprehensive monthly report on 1st of each
                                                month</small>
                                        </div>
                                        <b-form-checkbox switch size="lg" checked></b-form-checkbox>
                                    </div>
                                </div>

                                <b-button variant="success">
                                    <i class="fas fa-save me-2"></i>Save Preferences
                                </b-button>
                            </b-card-body>
                        </b-card>
                    </b-col>

                    <!-- Notification Summary -->
                    <b-col lg="4">
                        <b-card class="border-0 shadow-sm mb-4">
                            <b-card-body>
                                <h6 class="fw-bold mb-3">Notification Summary</h6>
                                <div class="mb-3">
                                    <div class="d-flex justify-content-between mb-2">
                                        <small class="text-muted">Email Address</small>
                                        <small class="fw-bold">odenyothadeus@gmail.com</small>
                                    </div>
                                    <div class="d-flex justify-content-between mb-2">
                                        <small class="text-muted">Active Notifications</small>
                                        <small class="fw-bold">7</small>
                                    </div>
                                    <div class="d-flex justify-content-between">
                                        <small class="text-muted">Emails This Week</small>
                                        <small class="fw-bold">42</small>
                                    </div>
                                </div>
                            </b-card-body>
                        </b-card>

                        <b-card class="border-0 shadow-sm">
                            <b-card-body>
                                <h6 class="fw-bold mb-3">Quick Actions</h6>
                                <div class="d-grid gap-2">
                                    <b-button variant="outline-primary" size="sm">
                                        <i class="fas fa-envelope me-2"></i>Test Email
                                    </b-button>
                                    <b-button variant="outline-secondary" size="sm">
                                        <i class="fas fa-bell-slash me-2"></i>Mute All (1 hour)
                                    </b-button>
                                    <b-button variant="outline-danger" size="sm">
                                        <i class="fas fa-ban me-2"></i>Disable All
                                    </b-button>
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
    // Future: Load notification settings from API
});
</script>