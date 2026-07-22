<template>
    <HomeLayout>
        <section class="auth-section py-5">
            <div class="container">
                <div class="row align-items-center g-5">

                    <!-- Left Side -->
                    <div class="col-lg-6">
                        <div class="pe-lg-4">

                            <div class="badge bg-success-subtle text-success mb-3 px-3 py-2 rounded-pill">
                                DEMULLA GATEWAY
                            </div>

                            <h1 class="fw-bold display-5 mb-3">
                                Forgot Password?
                                <span class="text-success d-block">No worries, we got you</span>
                            </h1>

                            <p class="text-muted fs-5 mb-4">
                                Enter the email address linked to your account and we'll
                                send you a secure password reset link.
                            </p>

                            <div class="feature-list">
                                <div class="d-flex mb-3">
                                    <div class="feature-icon me-3">
                                        <i class="fas fa-envelope"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">Check Your Email</h6>
                                        <small class="text-muted">We'll send a reset link to your inbox</small>
                                    </div>
                                </div>

                                <div class="d-flex mb-3">
                                    <div class="feature-icon me-3">
                                        <i class="fas fa-clock"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">Link Expires in 10 Minutes</h6>
                                        <small class="text-muted">Act quickly once you receive the email</small>
                                    </div>
                                </div>

                                <div class="d-flex">
                                    <div class="feature-icon me-3">
                                        <i class="fas fa-shield-alt"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">Secure Reset</h6>
                                        <small class="text-muted">Your account stays protected throughout</small>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    <!-- Right Side -->
                    <div class="col-lg-6">
                        <div class="auth-card">

                            <div class="text-center mb-4">
                                <img :src="logoSm" height="55" class="mb-3 rounded" />
                                <h3 class="fw-bold mb-2">Reset Password</h3>
                                <p class="text-muted">Enter your email to receive a reset link</p>
                            </div>

                            <b-form @submit.prevent="submitForgotPassword">
                                <StatesComponent />

                                <b-form-group class="mb-4">
                                    <label class="form-label fw-semibold">
                                        Email Address <span class="text-danger">*</span>
                                    </label>
                                    <b-form-input v-model="form.email" type="email" required
                                        placeholder="you@example.com" class="custom-input" />
                                </b-form-group>

                                <div class="d-grid mb-3">
                                    <b-button type="submit" variant="success" size="lg" class="auth-btn">
                                        Send Reset Link
                                        <i class="fas fa-paper-plane ms-2"></i>
                                    </b-button>
                                </div>

                                <div class="text-center">
                                    <router-link :to="{ name: 'auth.signin' }"
                                        class="text-success text-decoration-none">
                                        <i class="fas fa-arrow-left me-1"></i> Back to Sign In
                                    </router-link>
                                </div>

                            </b-form>

                        </div>
                    </div>

                </div>
            </div>
        </section>
    </HomeLayout>
</template>

<script setup>
import { reactive } from 'vue'
import HomeLayout from '@/layouts/HomeLayout.vue'
import logoSm from '@/assets/images/demulla.jpeg'
import StatesComponent from '@/states/StatesComponent.vue'
import authService from '@/api/auth/authApi.js'
import { useApiState } from '@/stores/apiState'
import { getValidationErrors } from '@/helpers/customErrors'

const apiState = useApiState()

const form = reactive({
    email: '',
})

const submitForgotPassword = async () => {
    try {
        apiState.setSaving(true)

        await authService.forgotPasswordApi(form)

        apiState.setSaving(false)
        apiState.setSuccess(true)
        apiState.setMessage('Password reset link has been sent to your email.')

    } catch (error) {
        apiState.setSaving(false)
        apiState.setError(true)

        if (error.errors && Object.keys(error.errors).length) {
            apiState.setMessage(getValidationErrors(error.errors).join(' '))
        } else {
            apiState.setMessage(error.message)
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