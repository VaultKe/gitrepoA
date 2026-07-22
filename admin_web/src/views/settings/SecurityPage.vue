<template>
    <DefaultLayout>
        <b-row class="justify-content-center">
            <b-col cols="12">
                <!-- Page Header -->
                <div class="mb-4">
                    <h4 class="fw-bold mb-1">Security Settings</h4>
                    <p class="text-muted mb-0">Manage your account security and authentication</p>
                </div>

                <b-row class="g-4">
                    <b-col lg="8">
                        <!-- Two-Factor Authentication -->
                        <b-card class="border-0 shadow-sm mb-4">
                            <b-card-header class="bg-white border-0">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h5 class="fw-bold mb-0">Two-Factor Authentication</h5>
                                    <span class="badge bg-success">Enabled</span>
                                </div>
                            </b-card-header>
                            <b-card-body>
                                <p class="text-muted mb-4">
                                    Two-factor authentication adds an extra layer of security to your account by
                                    requiring a code from your authenticator app.
                                </p>

                                <div class="mb-4">
                                    <h6 class="fw-bold mb-3">Authenticator App</h6>
                                    <div class="border rounded p-3 mb-3">
                                        <div class="d-flex align-items-center">
                                            <i class="fas fa-mobile-alt text-success fs-3 me-3"></i>
                                            <div class="flex-grow-1">
                                                <div class="fw-bold">Google Authenticator</div>
                                                <small class="text-muted">Last used: 2 hours ago</small>
                                            </div>
                                            <b-button variant="outline-danger" size="sm">
                                                <i class="fas fa-trash"></i> Remove
                                            </b-button>
                                        </div>
                                    </div>
                                </div>

                                <div class="mb-4">
                                    <h6 class="fw-bold mb-3">Recovery Codes</h6>
                                    <p class="text-muted small mb-2">
                                        Keep these codes in a safe place. You can use them to access your account if you
                                        lose your authenticator device.
                                    </p>
                                    <b-button variant="outline-primary" size="sm">
                                        <i class="fas fa-eye me-2"></i>View Recovery Codes
                                    </b-button>
                                    <b-button variant="outline-secondary" size="sm" class="ms-2">
                                        <i class="fas fa-sync me-2"></i>Regenerate Codes
                                    </b-button>
                                </div>

                                <div class="bg-light p-3 rounded">
                                    <small class="text-muted">
                                        <i class="fas fa-info-circle me-2"></i>
                                        2FA was enabled on January 15, 2026
                                    </small>
                                </div>
                            </b-card-body>
                        </b-card>

                        <!-- Active Sessions -->
                        <b-card class="border-0 shadow-sm">
                            <b-card-header class="bg-white border-0">
                                <h5 class="fw-bold mb-0">Active Sessions</h5>
                            </b-card-header>
                            <b-card-body>
                                <p class="text-muted mb-4">
                                    These devices are currently logged in to your account. Remove any sessions that you
                                    don't recognize.
                                </p>

                                <!-- Current Session -->
                                <div class="border rounded p-3 mb-3">
                                    <div class="d-flex align-items-center">
                                        <i class="fas fa-desktop text-primary fs-3 me-3"></i>
                                        <div class="flex-grow-1">
                                            <div class="fw-bold">
                                                MacBook Pro
                                                <span class="badge bg-primary-subtle text-primary ms-2">Current</span>
                                            </div>
                                            <small class="text-muted">Chrome • Nairobi, Kenya • Active now</small>
                                        </div>
                                    </div>
                                </div>

                                <!-- Other Sessions -->
                                <div class="border rounded p-3 mb-3">
                                    <div class="d-flex align-items-center">
                                        <i class="fas fa-mobile text-success fs-3 me-3"></i>
                                        <div class="flex-grow-1">
                                            <div class="fw-bold">iPhone 14 Pro</div>
                                            <small class="text-muted">Safari • Nairobi, Kenya • 2 hours ago</small>
                                        </div>
                                        <b-button variant="outline-danger" size="sm">
                                            <i class="fas fa-sign-out-alt"></i> Logout
                                        </b-button>
                                    </div>
                                </div>

                                <div class="border rounded p-3">
                                    <div class="d-flex align-items-center">
                                        <i class="fas fa-tablet text-warning fs-3 me-3"></i>
                                        <div class="flex-grow-1">
                                            <div class="fw-bold">iPad Air</div>
                                            <small class="text-muted">Safari • Nairobi, Kenya • 1 day ago</small>
                                        </div>
                                        <b-button variant="outline-danger" size="sm">
                                            <i class="fas fa-sign-out-alt"></i> Logout
                                        </b-button>
                                    </div>
                                </div>

                                <div class="mt-3">
                                    <b-button variant="outline-danger" size="sm">
                                        <i class="fas fa-sign-out-alt me-2"></i>Logout All Other Sessions
                                    </b-button>
                                </div>
                            </b-card-body>
                        </b-card>
                    </b-col>

                    <!-- Security Summary -->
                    <b-col lg="4">
                        <b-card class="border-0 shadow-sm mb-4">
                            <b-card-body>
                                <h6 class="fw-bold mb-3">Security Score</h6>
                                <div class="text-center mb-3">
                                    <div class="position-relative d-inline-block">
                                        <svg width="120" height="120">
                                            <circle cx="60" cy="60" r="50" fill="none" stroke="#e9ecef"
                                                stroke-width="10"></circle>
                                            <circle cx="60" cy="60" r="50" fill="none" stroke="#198754"
                                                stroke-width="10" stroke-dasharray="314" stroke-dashoffset="78.5"
                                                transform="rotate(-90 60 60)"></circle>
                                        </svg>
                                        <div class="position-absolute top-50 start-50 translate-middle">
                                            <h3 class="fw-bold mb-0">75%</h3>
                                            <small class="text-muted">Good</small>
                                        </div>
                                    </div>
                                </div>
                                <div class="small">
                                    <div class="d-flex align-items-center mb-2">
                                        <i class="fas fa-check-circle text-success me-2"></i>
                                        <span>2FA Enabled</span>
                                    </div>
                                    <div class="d-flex align-items-center mb-2">
                                        <i class="fas fa-check-circle text-success me-2"></i>
                                        <span>Strong Password</span>
                                    </div>
                                    <div class="d-flex align-items-center mb-2">
                                        <i class="fas fa-times-circle text-danger me-2"></i>
                                        <span>Email not verified</span>
                                    </div>
                                </div>
                            </b-card-body>
                        </b-card>

                        <b-card class="border-0 shadow-sm">
                            <b-card-body>
                                <h6 class="fw-bold mb-3">Security Tips</h6>
                                <ul class="small text-muted ps-3 mb-0">
                                    <li class="mb-2">Use a unique password for this account</li>
                                    <li class="mb-2">Review active sessions regularly</li>
                                    <li class="mb-2">Keep recovery codes in a safe place</li>
                                    <li>Enable notifications for login attempts</li>
                                </ul>
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
    // Future: Load security settings from API
});
</script>