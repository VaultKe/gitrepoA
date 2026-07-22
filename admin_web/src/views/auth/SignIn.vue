<template>
    <HomeLayout>
        <section class="auth-section py-5">
            <div class="container">
                <div class="row align-items-center g-5">

                    <!-- Left Side (Brand / Info) -->
                    <div class="col-lg-6">
                        <div class="pe-lg-4">

                            <div class="badge bg-success-subtle text-success mb-3 px-3 py-2 rounded-pill">
                                DEMULLA GATEWAY
                            </div>

                            <h1 class="fw-bold display-5 mb-3">
                                Welcome Back 👋
                                <span class="text-success d-block">Let’s get you in</span>
                            </h1>

                            <p class="text-muted fs-5 mb-4">
                                Sign in to manage your M-Pesa integrations, track transactions,
                                and access your developer dashboard.
                            </p>

                            <div class="feature-list">
                                <div class="d-flex mb-3">
                                    <div class="feature-icon me-3">
                                        <i class="fas fa-shield-alt"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">Secure Access</h6>
                                        <small class="text-muted">Protected login with encrypted sessions</small>
                                    </div>
                                </div>

                                <div class="d-flex mb-3">
                                    <div class="feature-icon me-3">
                                        <i class="fas fa-bolt"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">Fast Dashboard</h6>
                                        <small class="text-muted">Instant access to your API tools</small>
                                    </div>
                                </div>

                                <div class="d-flex">
                                    <div class="feature-icon me-3">
                                        <i class="fas fa-chart-line"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">Live Analytics</h6>
                                        <small class="text-muted">Track transactions in real time</small>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    <!-- Right Side (Form) -->
                    <div class="col-lg-6">
                        <div class="auth-card">

                            <div class="text-center mb-4">
                                <img :src="logoSm" height="55" class="mb-3 rounded" />

                                <h3 class="fw-bold mb-2">Sign In</h3>
                                <p class="text-muted">Access your Demulla account</p>
                            </div>

                            <b-form @submit.prevent="login">
                                <StatesComponent />

                                <b-form-group class="mb-3">
                                    <label class="form-label fw-semibold">Email<span
                                            class="text-danger">*</span></label>
                                    <b-form-input v-model="form.email" required placeholder="you@example.com"
                                        class="custom-input" />
                                </b-form-group>

                                <b-form-group class="mb-3">
                                    <label class="form-label fw-semibold">Password<span
                                            class="text-danger">*</span></label>
                                    <b-form-input v-model="form.password" required type="password"
                                        placeholder="Enter your password" class="custom-input" />
                                </b-form-group>

                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <b-form-checkbox v-model="form.remember">
                                        Remember me
                                    </b-form-checkbox>

                                    <router-link to="/auth/forgot-password" class="text-success text-decoration-none">
                                        Forgot password?
                                    </router-link>
                                </div>

                                <div class="d-grid">
                                    <b-button type="submit" variant="success" size="lg" class="auth-btn">
                                        Sign In
                                        <i class="fas fa-arrow-right ms-2"></i>
                                    </b-button>
                                </div>

                            </b-form>

                            <div class="text-center mt-4">
                                <p class="text-muted mb-0">
                                    Don’t have an account?
                                    <router-link to="/auth/signup"
                                        class="fw-semibold text-success text-decoration-none">
                                        Create Account
                                    </router-link>
                                </p>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </section>
    </HomeLayout>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import HomeLayout from '@/layouts/HomeLayout.vue'
import logoSm from '@/assets/images/demulla.jpeg'
import StatesComponent from '@/states/StatesComponent.vue'
import authService from '@/api/auth/authApi.js'
import { useApiState } from '@/stores/apiState'
import { getValidationErrors } from '@/helpers/customErrors'

const router = useRouter()
const apiState = useApiState()

const form = reactive({
    email: '',
    password: '',
    remember: false
})

const login = async () => {
    try {
        apiState.setSaving(true);

        const response = await authService.loginApi(form);

        apiState.setSaving(false);

        if (response.data?.requires_2fa_setup) {
            router.push({
                name: 'auth.setup',
                state: {
                    authToken: response.data.auth_token,
                    qrCodeUrl: response.data.qr_code_url,
                    secret: response.data.secret,
                    email: form.email,
                }
            });
            return;
        }

        if (response.data?.requires_2fa_code) {
            router.push({
                name: 'auth.verify',
                state: {
                    authToken: response.data.auth_token,
                    email: form.email,
                }
            });
            return;
        }

        apiState.setSuccess(true);
        apiState.setMessage(response.message);

    } catch (error) {
        apiState.setSaving(false);
        apiState.setError(true);

        if (error.errors && Object.keys(error.errors).length) {
            apiState.setMessage(getValidationErrors(error.errors).join(' '));
        } else {
            apiState.setMessage(error.message);
        }
    }
}
</script>

<style scoped>
.auth-section {
    min-height: calc(100vh - 80px);
    display: flex;
    align-items: center;
}

.auth-card {
    background: white;
    border-radius: 24px;
    padding: 40px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.06);
    border: 1px solid rgba(0, 0, 0, 0.04);
}

.custom-input {
    height: 52px;
    border-radius: 12px;
    border: 1px solid #dfe3e8;
    padding-left: 14px;
    transition: all 0.25s ease;
}

.custom-input:focus {
    border-color: #20c997;
    box-shadow: 0 0 0 0.2rem rgba(32, 201, 151, 0.15);
}

.auth-btn {
    height: 54px;
    border-radius: 12px;
    font-weight: 600;
}

.feature-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: rgba(32, 201, 151, 0.12);
    color: #20c997;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>