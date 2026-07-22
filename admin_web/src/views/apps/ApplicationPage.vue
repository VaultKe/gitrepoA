<template>
    <DefaultLayout>
        <b-row class="justify-content-center">
            <b-col cols="12">
                <!-- Page Header -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h4 class="fw-bold mb-1">Applications</h4>
                        <p class="text-muted mb-0">Manage your M-Pesa integration applications</p>
                    </div>
                    <b-button variant="success" size="lg">
                        <i class="fas fa-plus-circle me-2"></i>Create New Application
                    </b-button>
                </div>

                <!-- Applications Grid -->
                <b-row class="g-4">
                    <!-- Application Card 1 -->
                    <b-col lg="4" md="6">
                        <b-card class="border-0 shadow-sm h-100">
                            <b-card-body>
                                <div class="d-flex justify-content-between align-items-start mb-3">
                                    <div class="d-flex align-items-center">
                                        <div class="avatar-md bg-success bg-opacity-10 rounded p-3 me-3">
                                            <i class="fas fa-mobile-alt text-success fs-3"></i>
                                        </div>
                                        <div>
                                            <h5 class="fw-bold mb-1">E-commerce App</h5>
                                            <span class="badge bg-success-subtle text-success">Production</span>
                                        </div>
                                    </div>
                                    <b-dropdown variant="link" no-caret toggle-class="text-muted p-0">
                                        <template #button-content>
                                            <i class="fas fa-ellipsis-v"></i>
                                        </template>
                                        <b-dropdown-item>
                                            <i class="fas fa-eye me-2"></i>View Details
                                        </b-dropdown-item>
                                        <b-dropdown-item>
                                            <i class="fas fa-edit me-2"></i>Edit
                                        </b-dropdown-item>
                                        <b-dropdown-item>
                                            <i class="fas fa-key me-2"></i>Manage Credentials
                                        </b-dropdown-item>
                                        <b-dropdown-divider></b-dropdown-divider>
                                        <b-dropdown-item variant="danger">
                                            <i class="fas fa-trash me-2"></i>Delete
                                        </b-dropdown-item>
                                    </b-dropdown>
                                </div>

                                <p class="text-muted mb-3">
                                    Main production application for online store payments and disbursements.
                                </p>

                                <!-- Stats -->
                                <div class="row g-3 mb-3">
                                    <div class="col-6">
                                        <div class="border rounded p-2 text-center">
                                            <h6 class="fw-bold mb-0">6,234</h6>
                                            <small class="text-muted">Transactions</small>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="border rounded p-2 text-center">
                                            <h6 class="fw-bold mb-0">99.2%</h6>
                                            <small class="text-muted">Success Rate</small>
                                        </div>
                                    </div>
                                </div>

                                <!-- Info -->
                                <div class="mb-3">
                                    <small class="text-muted d-block mb-1">
                                        <i class="fas fa-calendar me-2"></i>Created: Jan 15, 2026
                                    </small>
                                    <small class="text-muted d-block mb-1">
                                        <i class="fas fa-clock me-2"></i>Last Transaction: 2 mins ago
                                    </small>
                                    <small class="text-muted d-block">
                                        <i class="fas fa-link me-2"></i>Slug: e-commerce-app
                                    </small>
                                </div>

                                <!-- Actions -->
                                <div class="d-grid gap-2">
                                    <b-button variant="outline-primary" size="sm">
                                        <i class="fas fa-cog me-2"></i>Configure
                                    </b-button>
                                </div>
                            </b-card-body>
                        </b-card>
                    </b-col>

                    <!-- Application Card 2 -->
                    <b-col lg="4" md="6">
                        <b-card class="border-0 shadow-sm h-100">
                            <b-card-body>
                                <div class="d-flex justify-content-between align-items-start mb-3">
                                    <div class="d-flex align-items-center">
                                        <div class="avatar-md bg-warning bg-opacity-10 rounded p-3 me-3">
                                            <i class="fas fa-mobile-alt text-warning fs-3"></i>
                                        </div>
                                        <div>
                                            <h5 class="fw-bold mb-1">Mobile Banking</h5>
                                            <span class="badge bg-warning-subtle text-warning">Sandbox</span>
                                        </div>
                                    </div>
                                    <b-dropdown variant="link" no-caret toggle-class="text-muted p-0">
                                        <template #button-content>
                                            <i class="fas fa-ellipsis-v"></i>
                                        </template>
                                        <b-dropdown-item>
                                            <i class="fas fa-eye me-2"></i>View Details
                                        </b-dropdown-item>
                                        <b-dropdown-item>
                                            <i class="fas fa-edit me-2"></i>Edit
                                        </b-dropdown-item>
                                        <b-dropdown-item>
                                            <i class="fas fa-key me-2"></i>Manage Credentials
                                        </b-dropdown-item>
                                        <b-dropdown-divider></b-dropdown-divider>
                                        <b-dropdown-item variant="danger">
                                            <i class="fas fa-trash me-2"></i>Delete
                                        </b-dropdown-item>
                                    </b-dropdown>
                                </div>

                                <p class="text-muted mb-3">
                                    Testing environment for mobile banking application features.
                                </p>

                                <!-- Stats -->
                                <div class="row g-3 mb-3">
                                    <div class="col-6">
                                        <div class="border rounded p-2 text-center">
                                            <h6 class="fw-bold mb-0">456</h6>
                                            <small class="text-muted">Transactions</small>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="border rounded p-2 text-center">
                                            <h6 class="fw-bold mb-0">95.5%</h6>
                                            <small class="text-muted">Success Rate</small>
                                        </div>
                                    </div>
                                </div>

                                <!-- Info -->
                                <div class="mb-3">
                                    <small class="text-muted d-block mb-1">
                                        <i class="fas fa-calendar me-2"></i>Created: Mar 10, 2026
                                    </small>
                                    <small class="text-muted d-block mb-1">
                                        <i class="fas fa-clock me-2"></i>Last Transaction: 1 hour ago
                                    </small>
                                    <small class="text-muted d-block">
                                        <i class="fas fa-link me-2"></i>Slug: mobile-banking
                                    </small>
                                </div>

                                <!-- Actions -->
                                <div class="d-grid gap-2">
                                    <b-button variant="outline-primary" size="sm">
                                        <i class="fas fa-cog me-2"></i>Configure
                                    </b-button>
                                </div>
                            </b-card-body>
                        </b-card>
                    </b-col>

                    <!-- Application Card 3 -->
                    <b-col lg="4" md="6">
                        <b-card class="border-0 shadow-sm h-100">
                            <b-card-body>
                                <div class="d-flex justify-content-between align-items-start mb-3">
                                    <div class="d-flex align-items-center">
                                        <div class="avatar-md bg-primary bg-opacity-10 rounded p-3 me-3">
                                            <i class="fas fa-mobile-alt text-primary fs-3"></i>
                                        </div>
                                        <div>
                                            <h5 class="fw-bold mb-1">Loan Platform</h5>
                                            <span class="badge bg-success-subtle text-success">Production</span>
                                        </div>
                                    </div>
                                    <b-dropdown variant="link" no-caret toggle-class="text-muted p-0">
                                        <template #button-content>
                                            <i class="fas fa-ellipsis-v"></i>
                                        </template>
                                        <b-dropdown-item>
                                            <i class="fas fa-eye me-2"></i>View Details
                                        </b-dropdown-item>
                                        <b-dropdown-item>
                                            <i class="fas fa-edit me-2"></i>Edit
                                        </b-dropdown-item>
                                        <b-dropdown-item>
                                            <i class="fas fa-key me-2"></i>Manage Credentials
                                        </b-dropdown-item>
                                        <b-dropdown-divider></b-dropdown-divider>
                                        <b-dropdown-item variant="danger">
                                            <i class="fas fa-trash me-2"></i>Delete
                                        </b-dropdown-item>
                                    </b-dropdown>
                                </div>

                                <p class="text-muted mb-3">
                                    Automated loan disbursement and repayment collection system.
                                </p>

                                <!-- Stats -->
                                <div class="row g-3 mb-3">
                                    <div class="col-6">
                                        <div class="border rounded p-2 text-center">
                                            <h6 class="fw-bold mb-0">5,768</h6>
                                            <small class="text-muted">Transactions</small>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="border rounded p-2 text-center">
                                            <h6 class="fw-bold mb-0">98.8%</h6>
                                            <small class="text-muted">Success Rate</small>
                                        </div>
                                    </div>
                                </div>

                                <!-- Info -->
                                <div class="mb-3">
                                    <small class="text-muted d-block mb-1">
                                        <i class="fas fa-calendar me-2"></i>Created: Feb 5, 2026
                                    </small>
                                    <small class="text-muted d-block mb-1">
                                        <i class="fas fa-clock me-2"></i>Last Transaction: 5 mins ago
                                    </small>
                                    <small class="text-muted d-block">
                                        <i class="fas fa-link me-2"></i>Slug: loan-platform
                                    </small>
                                </div>

                                <!-- Actions -->
                                <div class="d-grid gap-2">
                                    <b-button variant="outline-primary" size="sm">
                                        <i class="fas fa-cog me-2"></i>Configure
                                    </b-button>
                                </div>
                            </b-card-body>
                        </b-card>
                    </b-col>
                </b-row>

                <!-- Empty State (hidden when apps exist) -->
                <!-- <div class="text-center py-5 d-none">
          <div class="mb-4">
            <i class="fas fa-mobile-alt text-muted" style="font-size: 64px;"></i>
          </div>
          <h5 class="fw-bold mb-2">No Applications Yet</h5>
          <p class="text-muted mb-4">Create your first application to start processing M-Pesa transactions</p>
          <b-button variant="success" size="lg">
            <i class="fas fa-plus-circle me-2"></i>Create Your First Application
          </b-button>
        </div> -->
            </b-col>
        </b-row>
    </DefaultLayout>
</template>

<script setup>
import { onMounted } from "vue";
import DefaultLayout from "@/layouts/DefaultLayout.vue";

onMounted(() => {
    // Future: Load applications from API
});
</script>

<style scoped>
.avatar-md {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>