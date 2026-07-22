<template>
    <HomeLayout>
        <section class="auth-section py-5">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col-lg-5">
                        <div class="auth-card text-center">

                            <!-- Header -->
                            <div class="mb-4">
                                <img :src="logoSm" height="55" class="rounded mb-3" />
                                <h3 class="fw-bold">Two-Factor Authentication</h3>
                                <p class="text-muted">
                                    Enter the 6-digit code from your Google Authenticator app
                                </p>
                            </div>

                            <!-- Invalid State — no auth token -->
                            <div v-if="!authToken" class="py-4">
                                <div class="error-icon mb-3">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </div>
                                <h5 class="fw-bold mb-2">Session Expired</h5>
                                <p class="text-muted mb-4">
                                    Your session has expired. Please sign in again.
                                </p>
                                <router-link :to="{ name: 'auth.signin' }" class="btn btn-success w-100 auth-btn">
                                    Back to Sign In
                                </router-link>
                            </div>

                            <!-- OTP Form -->
                            <b-form v-else @submit.prevent="verifyOtp">
                                <StatesComponent />

                                <div class="otp-wrapper mb-4">
                                    <input v-for="(digit, index) in otp" :key="index" v-model="otp[index]" maxlength="1"
                                        class="otp-box" type="text" inputmode="numeric"
                                        @input="focusNext(index, $event)"
                                        @keydown.backspace="focusPrev(index, $event)" />
                                </div>

                                <b-button type="submit" variant="success" class="w-100 auth-btn">
                                    Verify
                                    <i class="fas fa-check ms-2"></i>
                                </b-button>

                            </b-form>

                            <div class="mt-3">
                                <small class="text-muted">
                                    Code refreshes every 30 seconds.
                                </small>
                            </div>

                            <div class="mt-3">
                                <router-link :to="{ name: 'auth.signin' }" class="text-success text-decoration-none">
                                    <i class="fas fa-arrow-left me-1"></i> Back to Sign In
                                </router-link>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </section>
    </HomeLayout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import HomeLayout from '@/layouts/HomeLayout.vue'
import logoSm from '@/assets/images/demulla.jpeg'
import StatesComponent from '@/states/StatesComponent.vue'
import authService from '@/api/auth/authApi.js'
import { useApiState } from '@/stores/apiState'
import { getValidationErrors } from '@/helpers/customErrors'

const router = useRouter()
const apiState = useApiState()

const otp = ref(['', '', '', '', '', ''])
const authToken = ref(history.state?.authToken ?? null)
const email = ref(history.state?.email ?? null)

const getOtpCode = () => otp.value.join('')

const focusNext = (index, event) => {
    const value = event.target.value
    if (value && index < 5) {
        const next = document.querySelectorAll('.otp-box')[index + 1]
        next?.focus()
    }
}

const focusPrev = (index, event) => {
    if (!otp.value[index] && index > 0) {
        const prev = document.querySelectorAll('.otp-box')[index - 1]
        prev?.focus()
    }
}

const verifyOtp = async () => {
    try {
        const code = getOtpCode()

        if (code.length !== 6) {
            apiState.setError(true)
            apiState.setMessage('Please enter a valid 6-digit code.')
            return
        }

        apiState.setSaving(true)

        const response = await authService.verify2FAApi({
            auth_token: authToken.value,
            email: email.value,
            code: code,
        })

        apiState.setSaving(false)
        apiState.setSuccess(true)
        apiState.setMessage(response.message)

        setTimeout(() => {
            router.push({ name: 'dashboard.index' })
        }, 1500)

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

.otp-wrapper {
    display: flex;
    justify-content: center;
    gap: 10px;
}

.otp-box {
    width: 48px;
    height: 56px;
    text-align: center;
    font-size: 22px;
    font-weight: bold;
    border-radius: 10px;
    border: 1px solid #dfe3e8;
    outline: none;
    transition: 0.2s;
}

.otp-box:focus {
    border-color: #20c997;
    box-shadow: 0 0 0 0.2rem rgba(32, 201, 151, 0.15);
}

.auth-btn {
    height: 52px;
    border-radius: 12px;
    font-weight: 600;
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