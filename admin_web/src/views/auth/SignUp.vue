<template>
    <HomeLayout>
        <section class="signup-section py-5">
            <div class="container">
                <div class="row align-items-center g-5">

                    <!-- Left Content -->
                    <div class="col-lg-5">
                        <div class="pe-lg-4">
                            <div class="badge bg-success-subtle text-success mb-3 px-3 py-2 rounded-pill">
                                DEMULLA GATEWAY
                            </div>

                            <h1 class="fw-bold display-5 mb-3">
                                Start Accepting
                                <span class="text-success">M-Pesa Payments</span>
                                Today
                            </h1>

                            <p class="text-muted fs-5 mb-4">
                                Create your developer account and integrate secure,
                                scalable M-Pesa payments into your applications in minutes.
                            </p>

                            <div class="feature-list">
                                <div class="d-flex mb-3">
                                    <div class="feature-icon me-3">
                                        <i class="fas fa-check"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">Fast Integration</h6>
                                        <small class="text-muted">
                                            Plug-and-play APIs with clean documentation
                                        </small>
                                    </div>
                                </div>

                                <div class="d-flex mb-3">
                                    <div class="feature-icon me-3">
                                        <i class="fas fa-shield-alt"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">Secure by Default</h6>
                                        <small class="text-muted">
                                            Built with enterprise-grade security
                                        </small>
                                    </div>
                                </div>

                                <div class="d-flex">
                                    <div class="feature-icon me-3">
                                        <i class="fas fa-bolt"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">Built for Scale</h6>
                                        <small class="text-muted">
                                            Reliable infrastructure trusted by businesses
                                        </small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right Form -->
                    <div class="col-lg-7">
                        <div class="signup-card">

                            <div class="text-center mb-4">
                                <img :src="logoSm" height="55" class="mb-3 rounded" />

                                <h3 class="fw-bold mb-2">
                                    Create Account
                                </h3>

                                <p class="text-muted">
                                    Get started with Demulla Gateway
                                </p>
                            </div>

                            <b-form @submit.prevent="register()">

                                <StatesComponent />

                                <div class="row">
                                    <div class="col-md-6">
                                        <b-form-group class="mb-3">
                                            <label class="form-label fw-semibold">
                                                First Name
                                            </label>

                                            <b-form-input placeholder="John" required class="custom-input" />
                                        </b-form-group>
                                    </div>

                                    <div class="col-md-6">
                                        <b-form-group class="mb-3">
                                            <label class="form-label fw-semibold">
                                                Last Name
                                            </label>

                                            <b-form-input required placeholder="Doe" class="custom-input" />
                                        </b-form-group>
                                    </div>
                                </div>

                                <div class="row">
                                    <div class="col-md-6">
                                        <b-form-group class="mb-3">
                                            <label class="form-label fw-semibold">
                                                Username
                                            </label>

                                            <b-form-input required placeholder="johndoe" class="custom-input" />
                                        </b-form-group>
                                    </div>

                                    <div class="col-md-6">
                                        <b-form-group class="mb-3">
                                            <label class="form-label fw-semibold">
                                                Phone Number
                                            </label>

                                            <b-form-input required placeholder="254708374149" class="custom-input" />
                                        </b-form-group>
                                    </div>
                                </div>

                                <b-form-group class="mb-3">
                                    <label class="form-label fw-semibold">
                                        Email Address
                                    </label>

                                    <b-form-input type="email" required placeholder="you@example.com"
                                        class="custom-input" />
                                </b-form-group>

                                <div class="row">
                                    <div class="col-md-6">
                                        <b-form-group class="mb-3">
                                            <label class="form-label fw-semibold">
                                                Password
                                            </label>

                                            <b-form-input required type="password" placeholder="Enter password"
                                                class="custom-input" />
                                        </b-form-group>
                                    </div>

                                    <div class="col-md-6">
                                        <b-form-group class="mb-3">
                                            <label class="form-label fw-semibold">
                                                Confirm Password
                                            </label>

                                            <b-form-input required type="password" placeholder="Confirm password"
                                                class="custom-input" />
                                        </b-form-group>
                                    </div>
                                </div>

                                <div class="mb-4">
                                    <b-form-checkbox>
                                        I agree to the
                                        <a href="#" class="text-success text-decoration-none">
                                            Terms
                                        </a>
                                        and
                                        <a href="#" class="text-success text-decoration-none">
                                            Privacy Policy
                                        </a>
                                    </b-form-checkbox>
                                </div>

                                <div class="d-grid">
                                    <b-button type="submit" variant="success" size="lg" class="signup-btn">
                                        Create Account
                                        <i class="fas fa-arrow-right ms-2"></i>
                                    </b-button>
                                </div>

                            </b-form>

                            <div class="text-center mt-4">
                                <p class="mb-0 text-muted">
                                    Already have an account?

                                    <router-link to="/auth/signin"
                                        class="fw-semibold text-success text-decoration-none">
                                        Sign In
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
import { ref } from 'vue'
import logoSm from '@/assets/images/demulla.jpeg';
import StatesComponent from '@/states/StatesComponent.vue';
import HomeLayout from '@/layouts/HomeLayout.vue';
import { useApiState } from '@/stores/apiState'

const apiState = useApiState()

const submitted = ref(false)

const register = () => {
    submitted.value = true
    apiState.setSuccess(true)
    apiState.setMessage('Thank you for your interest! Registration will be opening soon. We will notify you.')
}
</script>
<style scoped>
.signup-section {
    min-height: calc(100vh - 80px);
    display: flex;
    align-items: center;
}

.signup-card {
    background: white;
    border-radius: 24px;
    padding: 40px;
    box-shadow:
        0 10px 40px rgba(0, 0, 0, 0.06);
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

.signup-btn {
    height: 54px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 15px;
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

.text-success {
    color: #20c997 !important;
}

@media (max-width: 991px) {
    .signup-card {
        padding: 28px;
    }
}
</style>