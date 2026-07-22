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
                                Set New Password
                                <span class="text-success d-block">Make it strong</span>
                            </h1>

                            <p class="text-muted fs-5 mb-4">
                                Choose a strong password that you haven't used before.
                                Your account security is our priority.
                            </p>

                            <div class="feature-list">
                                <div class="d-flex mb-3">
                                    <div class="feature-icon me-3">
                                        <i class="fas fa-lock"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">Minimum 8 Characters</h6>
                                        <small class="text-muted">Use a mix of letters, numbers and symbols</small>
                                    </div>
                                </div>

                                <div class="d-flex mb-3">
                                    <div class="feature-icon me-3">
                                        <i class="fas fa-clock"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">Link Expires in 10 Minutes</h6>
                                        <small class="text-muted">Complete this before your link expires</small>
                                    </div>
                                </div>

                                <div class="d-flex">
                                    <div class="feature-icon me-3">
                                        <i class="fas fa-sign-out-alt"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">All Sessions Revoked</h6>
                                        <small class="text-muted">All active sessions will be logged out</small>
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
                                <h3 class="fw-bold mb-2">New Password</h3>
                                <p class="text-muted">Enter and confirm your new password</p>
                            </div>

                            <!-- Invalid / Missing Token -->
                            <div v-if="!token" class="text-center py-4">
                                <div class="error-icon mb-3">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </div>
                                <h5 class="fw-bold mb-2">Invalid Reset Link</h5>
                                <p class="text-muted mb-4">
                                    This password reset link is invalid or has expired.
                                    Please request a new one.
                                </p>
                                <router-link :to="{ name: 'auth.forgot-password' }"
                                    class="btn btn-success auth-btn w-100">
                                    Request New Link
                                </router-link>
                            </div>

                            <!-- Form State -->
                            <b-form v-else @submit.prevent="submitResetPassword">
                                <StatesComponent />

                                <b-form-group class="mb-3">
                                    <label class="form-label fw-semibold">
                                        New Password <span class="text-danger">*</span>
                                    </label>
                                    <b-form-input v-model="form.password" type="password" required
                                        placeholder="Minimum 8 characters" class="custom-input" />
                                </b-form-group>

                                <b-form-group class="mb-4">
                                    <label class="form-label fw-semibold">
                                        Confirm New Password <span class="text-danger">*</span>
                                    </label>
                                    <b-form-input v-model="form.password_confirmation" type="password" required
                                        placeholder="Repeat your new password" class="custom-input" />
                                </b-form-group>

                                <div class="d-grid mb-3">
                                    <b-button type="submit" variant="success" size="lg" class="auth-btn">
                                        Reset Password
                                        <i class="fas fa-check ms-2"></i>
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
import { reactive, ref, onMounted } from 'vue'
import HomeLayout from '@/layouts/HomeLayout.vue'
import logoSm from '@/assets/images/demulla.jpeg'
import { useRoute, useRouter } from 'vue-router'
import StatesComponent from '@/states/StatesComponent.vue'
import authService from '@/api/auth/authApi.js'
import { useApiState } from '@/stores/apiState'
import { getValidationErrors } from '@/helpers/customErrors'
const route = useRoute()
const router = useRouter()
const apiState = useApiState()
const token = ref(null)

const form = reactive({
    password: '',
    password_confirmation: '',
})

onMounted(() => {
    token.value = route.query.token ?? null
})

const submitResetPassword = async () => {
    try {
        apiState.setSaving(true)

        await authService.resetPasswordApi({
            token: token.value,
            password: form.password,
            password_confirmation: form.password_confirmation,
        })

        apiState.setSaving(false)
        apiState.setSuccess(true)
        apiState.setMessage('Password reset successful. Please sign in with your new password.')
        setTimeout(() => {
            router.push({ name: 'auth.signin' })
        }, 2000)

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

.error-icon {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: rgba(220, 53, 69, 0.1);
    color: #dc3545;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    margin: 0 auto;
}
</style>