<template>
    <DefaultLayout>
        <b-row class="justify-content-center">
            <b-col cols="12">
                <!-- Page Header -->
                <div class="mb-4">
                    <h4 class="fw-bold mb-1">Reports & Analytics</h4>
                    <p class="text-muted mb-0">Generate and download transaction reports</p>
                </div>

                <!-- Report Filters -->
                <b-row class="g-4 mb-4">
                    <b-col lg="8">
                        <b-card class="border-0 shadow-sm">
                            <b-card-header class="bg-white border-0">
                                <h5 class="fw-bold mb-0">Generate Report</h5>
                            </b-card-header>
                            <b-card-body>
                                <b-row class="g-3">
                                    <b-col md="6">
                                        <label class="form-label">Report Type</label>
                                        <b-form-select>
                                            <option value="summary">Transaction Summary</option>
                                            <option value="revenue">Revenue Report</option>
                                            <option value="performance">Application Performance</option>
                                            <option value="callback">Callback Success Rate</option>
                                        </b-form-select>
                                    </b-col>

                                    <b-col md="6">
                                        <label class="form-label">Date Range</label>
                                        <b-form-select>
                                            <option value="today">Today</option>
                                            <option value="week">This Week</option>
                                            <option value="month">This Month</option>
                                            <option value="last_month">Last Month</option>
                                            <option value="custom">Custom Range</option>
                                        </b-form-select>
                                    </b-col>

                                    <b-col md="6">
                                        <label class="form-label">Application</label>
                                        <b-form-select>
                                            <option value="">All Applications</option>
                                            <option value="app1">E-commerce App</option>
                                            <option value="app2">Mobile Banking</option>
                                            <option value="app3">Loan Platform</option>
                                        </b-form-select>
                                    </b-col>

                                    <b-col md="6">
                                        <label class="form-label">Export Format</label>
                                        <b-form-select>
                                            <option value="pdf">PDF</option>
                                            <option value="csv">CSV</option>
                                            <option value="excel">Excel</option>
                                        </b-form-select>
                                    </b-col>

                                    <b-col cols="12">
                                        <b-button variant="success" size="lg" class="w-100">
                                            <i class="fas fa-file-download me-2"></i>Generate Report
                                        </b-button>
                                    </b-col>
                                </b-row>
                            </b-card-body>
                        </b-card>
                    </b-col>

                    <!-- Quick Stats -->
                    <b-col lg="4">
                        <b-card class="border-0 shadow-sm mb-3">
                            <b-card-body>
                                <div class="text-center">
                                    <i class="fas fa-file-alt text-primary mb-3" style="font-size: 48px;"></i>
                                    <h3 class="fw-bold mb-1">1,234</h3>
                                    <p class="text-muted mb-0">Reports Generated</p>
                                </div>
                            </b-card-body>
                        </b-card>

                        <b-card class="border-0 shadow-sm">
                            <b-card-body>
                                <div class="text-center">
                                    <i class="fas fa-download text-success mb-3" style="font-size: 48px;"></i>
                                    <h3 class="fw-bold mb-1">856</h3>
                                    <p class="text-muted mb-0">Downloads This Month</p>
                                </div>
                            </b-card-body>
                        </b-card>
                    </b-col>
                </b-row>

                <!-- Recent Reports -->
                <b-card class="border-0 shadow-sm">
                    <b-card-header class="bg-white border-0">
                        <h5 class="fw-bold mb-0">Recent Reports</h5>
                    </b-card-header>
                    <b-card-body class="p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th class="border-0 px-4">Report Name</th>
                                        <th class="border-0">Type</th>
                                        <th class="border-0">Date Range</th>
                                        <th class="border-0">Generated</th>
                                        <th class="border-0">Format</th>
                                        <th class="border-0 text-end px-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td class="px-4">May 2026 Transaction Summary</td>
                                        <td><span class="badge bg-primary-subtle text-primary">Summary</span></td>
                                        <td>May 1 - May 24, 2026</td>
                                        <td>May 24, 2026 15:30</td>
                                        <td><span class="badge bg-danger-subtle text-danger">PDF</span></td>
                                        <td class="text-end px-4">
                                            <b-button size="sm" variant="outline-primary">
                                                <i class="fas fa-download"></i>
                                            </b-button>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td class="px-4">E-commerce App Performance</td>
                                        <td><span class="badge bg-success-subtle text-success">Performance</span></td>
                                        <td>May 1 - May 24, 2026</td>
                                        <td>May 23, 2026 10:15</td>
                                        <td><span class="badge bg-success-subtle text-success">Excel</span></td>
                                        <td class="text-end px-4">
                                            <b-button size="sm" variant="outline-primary">
                                                <i class="fas fa-download"></i>
                                            </b-button>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td class="px-4">Weekly Revenue Report</td>
                                        <td><span class="badge bg-warning-subtle text-warning">Revenue</span></td>
                                        <td>May 17 - May 23, 2026</td>
                                        <td>May 23, 2026 09:00</td>
                                        <td><span class="badge bg-info-subtle text-info">CSV</span></td>
                                        <td class="text-end px-4">
                                            <b-button size="sm" variant="outline-primary">
                                                <i class="fas fa-download"></i>
                                            </b-button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </b-card-body>
                </b-card>
            </b-col>
        </b-row>
    </DefaultLayout>
</template>

<script setup>
import { onMounted } from "vue";
import DefaultLayout from "@/layouts/DefaultLayout.vue";

onMounted(() => {
    // Future: Load reports from API
});
</script>