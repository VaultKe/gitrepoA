<template>
    <DefaultLayout>
        <b-row class="justify-content-center">
            <b-col cols="12">
                <!-- Welcome Header -->
                <div class="mb-4">
                    <h4 class="fw-bold">Welcome back, John! 👋</h4>
                    <p class="text-muted mb-0">Here's what's happening with your gateway today.</p>
                </div>

                <!-- Quick Stats Cards -->
                <b-row class="g-3 mb-4">
                    <!-- Total Applications -->
                    <b-col lg="3" md="6">
                        <b-card class="border-0 shadow-sm h-100">
                            <div class="d-flex align-items-center">
                                <div class="flex-shrink-0">
                                    <div class="avatar-sm rounded-circle bg-success bg-opacity-10 p-2">
                                        <i class="fas fa-mobile-alt text-success fs-4"></i>
                                    </div>
                                </div>
                                <div class="flex-grow-1 ms-3">
                                    <p class="text-muted mb-1 fs-13">Total Applications</p>
                                    <h4 class="mb-0 fw-bold">3</h4>
                                    <small class="text-success">
                                        <i class="fas fa-arrow-up me-1"></i>+1 this month
                                    </small>
                                </div>
                            </div>
                        </b-card>
                    </b-col>

                    <!-- Total Transactions -->
                    <b-col lg="3" md="6">
                        <b-card class="border-0 shadow-sm h-100">
                            <div class="d-flex align-items-center">
                                <div class="flex-shrink-0">
                                    <div class="avatar-sm rounded-circle bg-primary bg-opacity-10 p-2">
                                        <i class="fas fa-exchange-alt text-primary fs-4"></i>
                                    </div>
                                </div>
                                <div class="flex-grow-1 ms-3">
                                    <p class="text-muted mb-1 fs-13">Total Transactions</p>
                                    <h4 class="mb-0 fw-bold">12,458</h4>
                                    <small class="text-success">
                                        <i class="fas fa-arrow-up me-1"></i>+234 today
                                    </small>
                                </div>
                            </div>
                        </b-card>
                    </b-col>

                    <!-- Success Rate -->
                    <b-col lg="3" md="6">
                        <b-card class="border-0 shadow-sm h-100">
                            <div class="d-flex align-items-center">
                                <div class="flex-shrink-0">
                                    <div class="avatar-sm rounded-circle bg-warning bg-opacity-10 p-2">
                                        <i class="fas fa-chart-line text-warning fs-4"></i>
                                    </div>
                                </div>
                                <div class="flex-grow-1 ms-3">
                                    <p class="text-muted mb-1 fs-13">Success Rate</p>
                                    <h4 class="mb-0 fw-bold">98.5%</h4>
                                    <small class="text-success">
                                        <i class="fas fa-arrow-up me-1"></i>+0.3% vs last week
                                    </small>
                                </div>
                            </div>
                        </b-card>
                    </b-col>

                    <!-- Total Volume -->
                    <b-col lg="3" md="6">
                        <b-card class="border-0 shadow-sm h-100">
                            <div class="d-flex align-items-center">
                                <div class="flex-shrink-0">
                                    <div class="avatar-sm rounded-circle bg-danger bg-opacity-10 p-2">
                                        <i class="fas fa-coins text-danger fs-4"></i>
                                    </div>
                                </div>
                                <div class="flex-grow-1 ms-3">
                                    <p class="text-muted mb-1 fs-13">Total Volume</p>
                                    <h4 class="mb-0 fw-bold">KES 2.4M</h4>
                                    <small class="text-success">
                                        <i class="fas fa-arrow-up me-1"></i>+KES 150K this week
                                    </small>
                                </div>
                            </div>
                        </b-card>
                    </b-col>
                </b-row>

                <!-- Transaction Overview Chart -->
                <b-row class="g-3 mb-4">
                    <b-col lg="8">
                        <b-card class="border-0 shadow-sm">
                            <b-card-header class="border-0 bg-white">
                                <b-row class="align-items-center">
                                    <b-col>
                                        <h5 class="fw-bold mb-0">Transaction Overview</h5>
                                    </b-col>
                                    <b-col class="text-end">
                                        <b-button-group size="sm">
                                            <b-button variant="outline-primary" class="active">7 Days</b-button>
                                            <b-button variant="outline-primary">30 Days</b-button>
                                            <b-button variant="outline-primary">90 Days</b-button>
                                        </b-button-group>
                                    </b-col>
                                </b-row>
                            </b-card-header>
                            <b-card-body>
                                <!-- Placeholder for Chart -->
                                <div class="chart-container"
                                    style="height: 300px; background: #f8f9fa; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                    <div class="text-center">
                                        <i class="fas fa-chart-area text-muted fs-1 mb-3"></i>
                                        <p class="text-muted mb-0">Transaction chart will be displayed here</p>
                                        <small class="text-muted">Integration with Chart.js or ApexCharts</small>
                                    </div>
                                </div>
                            </b-card-body>
                        </b-card>
                    </b-col>

                    <!-- Transaction Types Breakdown -->
                    <b-col lg="4">
                        <b-card class="border-0 shadow-sm h-100">
                            <b-card-header class="border-0 bg-white">
                                <h5 class="fw-bold mb-0">Transaction Types</h5>
                            </b-card-header>
                            <b-card-body>
                                <!-- B2C -->
                                <div class="mb-3">
                                    <div class="d-flex justify-content-between align-items-center mb-1">
                                        <span class="text-muted">
                                            <i class="fas fa-arrow-right text-success me-2"></i>B2C Disbursements
                                        </span>
                                        <span class="fw-bold">4,234</span>
                                    </div>
                                    <b-progress :value="60" variant="success" class="mb-0"
                                        style="height: 6px"></b-progress>
                                </div>

                                <!-- STK Push -->
                                <div class="mb-3">
                                    <div class="d-flex justify-content-between align-items-center mb-1">
                                        <span class="text-muted">
                                            <i class="fas fa-mobile text-primary me-2"></i>STK Push
                                        </span>
                                        <span class="fw-bold">6,890</span>
                                    </div>
                                    <b-progress :value="80" variant="primary" class="mb-0"
                                        style="height: 6px"></b-progress>
                                </div>

                                <!-- Paybill -->
                                <div class="mb-3">
                                    <div class="d-flex justify-content-between align-items-center mb-1">
                                        <span class="text-muted">
                                            <i class="fas fa-building text-warning me-2"></i>Paybill
                                        </span>
                                        <span class="fw-bold">1,123</span>
                                    </div>
                                    <b-progress :value="40" variant="warning" class="mb-0"
                                        style="height: 6px"></b-progress>
                                </div>

                                <!-- Status Queries -->
                                <div>
                                    <div class="d-flex justify-content-between align-items-center mb-1">
                                        <span class="text-muted">
                                            <i class="fas fa-search text-info me-2"></i>Status Queries
                                        </span>
                                        <span class="fw-bold">211</span>
                                    </div>
                                    <b-progress :value="20" variant="info" class="mb-0"
                                        style="height: 6px"></b-progress>
                                </div>
                            </b-card-body>
                        </b-card>
                    </b-col>
                </b-row>

                <!-- Recent Transactions & Applications -->
                <b-row class="g-3">
                    <!-- Recent Transactions -->
                    <b-col lg="8">
                        <b-card class="border-0 shadow-sm">
                            <b-card-header class="border-0 bg-white">
                                <b-row class="align-items-center">
                                    <b-col>
                                        <h5 class="fw-bold mb-0">Recent Transactions</h5>
                                    </b-col>
                                    <b-col class="text-end">
                                        <b-link href="/transactions" class="text-primary text-decoration-none">
                                            View All <i class="fas fa-arrow-right ms-1"></i>
                                        </b-link>
                                    </b-col>
                                </b-row>
                            </b-card-header>
                            <b-card-body class="pt-0">
                                <div class="table-responsive">
                                    <table class="table table-hover align-middle mb-0">
                                        <thead class="table-light">
                                            <tr>
                                                <th class="border-0">Transaction ID</th>
                                                <th class="border-0">Type</th>
                                                <th class="border-0">Amount</th>
                                                <th class="border-0">Phone</th>
                                                <th class="border-0">Status</th>
                                                <th class="border-0">Date</th>
                                                <th class="border-0 text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <!-- Transaction 1 -->
                                            <tr>
                                                <td>
                                                    <small class="font-monospace text-muted">9c8f7e6d...</small>
                                                </td>
                                                <td>
                                                    <span class="badge bg-success-subtle text-success">
                                                        <i class="fas fa-mobile me-1"></i>STK Push
                                                    </span>
                                                </td>
                                                <td class="fw-bold">KES 1,500</td>
                                                <td>254708374149</td>
                                                <td>
                                                    <span class="badge bg-success">
                                                        <i class="fas fa-check-circle me-1"></i>Success
                                                    </span>
                                                </td>
                                                <td>
                                                    <small class="text-muted">2 mins ago</small>
                                                </td>
                                                <td class="text-end">
                                                    <b-button size="sm" variant="outline-primary">
                                                        <i class="fas fa-eye"></i>
                                                    </b-button>
                                                </td>
                                            </tr>

                                            <!-- Transaction 2 -->
                                            <tr>
                                                <td>
                                                    <small class="font-monospace text-muted">7a3b2c1d...</small>
                                                </td>
                                                <td>
                                                    <span class="badge bg-primary-subtle text-primary">
                                                        <i class="fas fa-arrow-right me-1"></i>B2C
                                                    </span>
                                                </td>
                                                <td class="fw-bold">KES 3,000</td>
                                                <td>254712345678</td>
                                                <td>
                                                    <span class="badge bg-warning">
                                                        <i class="fas fa-clock me-1"></i>Processing
                                                    </span>
                                                </td>
                                                <td>
                                                    <small class="text-muted">5 mins ago</small>
                                                </td>
                                                <td class="text-end">
                                                    <b-button size="sm" variant="outline-primary">
                                                        <i class="fas fa-eye"></i>
                                                    </b-button>
                                                </td>
                                            </tr>

                                            <!-- Transaction 3 -->
                                            <tr>
                                                <td>
                                                    <small class="font-monospace text-muted">5d4c3b2a...</small>
                                                </td>
                                                <td>
                                                    <span class="badge bg-warning-subtle text-warning">
                                                        <i class="fas fa-building me-1"></i>Paybill
                                                    </span>
                                                </td>
                                                <td class="fw-bold">KES 5,200</td>
                                                <td>254798765432</td>
                                                <td>
                                                    <span class="badge bg-success">
                                                        <i class="fas fa-check-circle me-1"></i>Success
                                                    </span>
                                                </td>
                                                <td>
                                                    <small class="text-muted">15 mins ago</small>
                                                </td>
                                                <td class="text-end">
                                                    <b-button size="sm" variant="outline-primary">
                                                        <i class="fas fa-eye"></i>
                                                    </b-button>
                                                </td>
                                            </tr>

                                            <!-- Transaction 4 -->
                                            <tr>
                                                <td>
                                                    <small class="font-monospace text-muted">3e2d1c0b...</small>
                                                </td>
                                                <td>
                                                    <span class="badge bg-success-subtle text-success">
                                                        <i class="fas fa-mobile me-1"></i>STK Push
                                                    </span>
                                                </td>
                                                <td class="fw-bold">KES 850</td>
                                                <td>254700111222</td>
                                                <td>
                                                    <span class="badge bg-danger">
                                                        <i class="fas fa-times-circle me-1"></i>Failed
                                                    </span>
                                                </td>
                                                <td>
                                                    <small class="text-muted">1 hour ago</small>
                                                </td>
                                                <td class="text-end">
                                                    <b-button size="sm" variant="outline-primary">
                                                        <i class="fas fa-eye"></i>
                                                    </b-button>
                                                </td>
                                            </tr>

                                            <!-- Transaction 5 -->
                                            <tr>
                                                <td>
                                                    <small class="font-monospace text-muted">1f0e9d8c...</small>
                                                </td>
                                                <td>
                                                    <span class="badge bg-primary-subtle text-primary">
                                                        <i class="fas fa-arrow-right me-1"></i>B2C
                                                    </span>
                                                </td>
                                                <td class="fw-bold">KES 2,100</td>
                                                <td>254722334455</td>
                                                <td>
                                                    <span class="badge bg-success">
                                                        <i class="fas fa-check-circle me-1"></i>Success
                                                    </span>
                                                </td>
                                                <td>
                                                    <small class="text-muted">2 hours ago</small>
                                                </td>
                                                <td class="text-end">
                                                    <b-button size="sm" variant="outline-primary">
                                                        <i class="fas fa-eye"></i>
                                                    </b-button>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </b-card-body>
                        </b-card>
                    </b-col>

                    <!-- Application Status -->
                    <b-col lg="4">
                        <b-card class="border-0 shadow-sm">
                            <b-card-header class="border-0 bg-white">
                                <b-row class="align-items-center">
                                    <b-col>
                                        <h5 class="fw-bold mb-0">Your Applications</h5>
                                    </b-col>
                                    <b-col class="text-end">
                                        <b-link href="/applications" class="text-primary text-decoration-none">
                                            <i class="fas fa-plus-circle"></i>
                                        </b-link>
                                    </b-col>
                                </b-row>
                            </b-card-header>
                            <b-card-body class="pt-0">
                                <!-- App 1 -->
                                <div class="border rounded p-3 mb-3">
                                    <div class="d-flex align-items-center mb-2">
                                        <div class="flex-shrink-0">
                                            <div class="avatar-xs bg-success bg-opacity-10 rounded-circle p-2">
                                                <i class="fas fa-mobile-alt text-success"></i>
                                            </div>
                                        </div>
                                        <div class="flex-grow-1 ms-2">
                                            <h6 class="mb-0 fw-bold">E-commerce App</h6>
                                            <small class="text-muted">Production</small>
                                        </div>
                                        <div class="flex-shrink-0">
                                            <span class="badge bg-success-subtle text-success">Active</span>
                                        </div>
                                    </div>
                                    <div class="d-flex justify-content-between text-muted small">
                                        <span>6,234 transactions</span>
                                        <span>2 mins ago</span>
                                    </div>
                                </div>

                                <!-- App 2 -->
                                <div class="border rounded p-3 mb-3">
                                    <div class="d-flex align-items-center mb-2">
                                        <div class="flex-shrink-0">
                                            <div class="avatar-xs bg-warning bg-opacity-10 rounded-circle p-2">
                                                <i class="fas fa-mobile-alt text-warning"></i>
                                            </div>
                                        </div>
                                        <div class="flex-grow-1 ms-2">
                                            <h6 class="mb-0 fw-bold">Mobile Banking</h6>
                                            <small class="text-muted">Sandbox</small>
                                        </div>
                                        <div class="flex-shrink-0">
                                            <span class="badge bg-warning-subtle text-warning">Testing</span>
                                        </div>
                                    </div>
                                    <div class="d-flex justify-content-between text-muted small">
                                        <span>456 transactions</span>
                                        <span>1 hour ago</span>
                                    </div>
                                </div>

                                <!-- App 3 -->
                                <div class="border rounded p-3">
                                    <div class="d-flex align-items-center mb-2">
                                        <div class="flex-shrink-0">
                                            <div class="avatar-xs bg-primary bg-opacity-10 rounded-circle p-2">
                                                <i class="fas fa-mobile-alt text-primary"></i>
                                            </div>
                                        </div>
                                        <div class="flex-grow-1 ms-2">
                                            <h6 class="mb-0 fw-bold">Loan Platform</h6>
                                            <small class="text-muted">Production</small>
                                        </div>
                                        <div class="flex-shrink-0">
                                            <span class="badge bg-success-subtle text-success">Active</span>
                                        </div>
                                    </div>
                                    <div class="d-flex justify-content-between text-muted small">
                                        <span>5,768 transactions</span>
                                        <span>5 mins ago</span>
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
    // Future: Load dashboard data
    // Future: Initialize charts
});
</script>

<style scoped>
.avatar-sm {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.avatar-xs {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.font-monospace {
    font-family: 'Courier New', monospace;
}

.table> :not(caption)>*>* {
    padding: 0.75rem 0.5rem;
}

.fs-13 {
    font-size: 13px;
}
</style>