<template>
    <HomeLayout>
        <section class="auth-section py-5">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col-lg-7">
                        <div class="auth-card text-center">

                            <div class="mb-3">
                                <img :src="logoSm" height="55" class="rounded mb-3" />
                                <h3 class="fw-bold">Enable Two-Factor Authentication</h3>
                                <p class="text-muted">Secure your account using Google Authenticator</p>
                            </div>

                            <!-- Invalid State — no auth token -->
                            <div v-if="!authToken" class="py-4">
                                <div class="error-icon mb-3">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </div>
                                <h5 class="fw-bold mb-2">Session Expired</h5>
                                <p class="text-muted mb-4">
                                    Your setup session has expired. Please sign in again to continue.
                                </p>
                                <router-link :to="{ name: 'auth.signin' }" class="btn btn-success w-100 auth-btn">
                                    Back to Sign In
                                </router-link>
                            </div>

                            <!-- STEP 1: QR CODE -->
                            <div v-else-if="step === 1">
                                <p class="text-muted mb-4">
                                    Scan this QR code using Google Authenticator
                                </p>

                                <div class="qr-box mb-4">
                                    <canvas ref="qrCanvas"></canvas>
                                </div>

                                <div class="mb-4">
                                    <small class="text-muted">Or enter this key manually:</small>
                                    <div class="secret-key mt-2">
                                        <code>{{ secret }}</code>
                                    </div>
                                </div>

                                <b-button variant="success" class="w-100 auth-btn" @click="step = 2">
                                    I've Scanned the Code
                                    <i class="fas fa-arrow-right ms-2"></i>
                                </b-button>
                            </div>

                            <!-- STEP 2: VERIFY OTP -->
                            <div v-else>
                                <p class="text-muted mb-3">
                                    Enter the 6-digit code from your Google Authenticator app
                                </p>

                                <b-form @submit.prevent="verifySetup">
                                    <StatesComponent />

                                    <b-form-input v-model="otp" placeholder="000000" maxlength="6" required
                                        class="custom-input text-center otp-input mb-3" />

                                    <b-button type="submit" variant="success" size="lg" class="w-100 auth-btn">
                                        Verify & Enable 2FA
                                        <i class="fas fa-check ms-2"></i>
                                    </b-button>

                                    <div class="mt-3">
                                        <a href="#" class="text-success text-decoration-none" @click.prevent="step = 1">
                                            <i class="fas fa-arrow-left me-1"></i> Back to QR Code
                                        </a>
                                    </div>

                                </b-form>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </section>
    </HomeLayout>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
import HomeLayout from '@/layouts/HomeLayout.vue'
import logoSm from '@/assets/images/demulla.jpeg'
import StatesComponent from '@/states/StatesComponent.vue'
import authService from '@/api/auth/authApi.js'
import { useApiState } from '@/stores/apiState'
import { getValidationErrors } from '@/helpers/customErrors'

const router = useRouter()
const apiState = useApiState()

const step = ref(1)
const otp = ref('')
const qrCanvas = ref(null)

// Pull state passed from SignIn.vue via router.push state
const authToken = ref(history.state?.authToken ?? null)
const qrCodeUrl = ref(history.state?.qrCodeUrl ?? null)
const secret = ref(history.state?.secret ?? null)
const email = ref(history.state?.email ?? null)

onMounted(async () => {
    if (qrCodeUrl.value) {
        await nextTick()
        QRCode.toCanvas(qrCanvas.value, qrCodeUrl.value, {
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff',
            }
        })
    }
})

const verifySetup = async () => {
    try {
        apiState.setSaving(true)

        await authService.setup2FAApi({
            auth_token: authToken.value,
            email: email.value,
            code: otp.value,
        })

        apiState.setSaving(false)
        apiState.setSuccess(true)
        apiState.setMessage('2FA enabled successfully. Redirecting to sign in...')

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

.qr-box {
    display: flex;
    justify-content: center;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 16px;
}

.secret-key {
    padding: 10px 16px;
    background: #f1f3f5;
    border-radius: 10px;
    display: inline-block;
    font-size: 15px;
    letter-spacing: 2px;
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

.otp-input {
    font-size: 26px;
    letter-spacing: 12px;
    font-weight: bold;
    text-align: center;
}

.auth-btn {
    height: 54px;
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