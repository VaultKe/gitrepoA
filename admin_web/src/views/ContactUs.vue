<template>
    <HomeLayout>
        <section class="contact-section py-5">
            <div class="container">
                <div class="row align-items-center g-5">

                    <!-- LEFT: Info -->
                    <div class="col-lg-6">
                        <div class="pe-lg-4">

                            <div class="badge bg-success-subtle text-success mb-3 px-3 py-2 rounded-pill">
                                DEMULLA SUPPORT
                            </div>

                            <h1 class="fw-bold display-5 mb-3">
                                Get in Touch
                                <span class="text-success d-block">We’re here to help</span>
                            </h1>

                            <p class="text-muted fs-5 mb-4">
                                Have questions about integration, billing, or technical support?
                                Our team is ready to assist you anytime.
                            </p>

                            <div class="contact-info">

                                <div class="d-flex mb-3">
                                    <div class="contact-icon me-3">
                                        <i class="fas fa-envelope"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">Email</h6>
                                        <small class="text-muted">support@demulla.com</small>
                                    </div>
                                </div>

                                <div class="d-flex mb-3">
                                    <div class="contact-icon me-3">
                                        <i class="fas fa-phone"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">Phone</h6>
                                        <small class="text-muted">+254 700 000 000</small>
                                    </div>
                                </div>

                                <div class="d-flex">
                                    <div class="contact-icon me-3">
                                        <i class="fas fa-clock"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-1 fw-semibold">Support Hours</h6>
                                        <small class="text-muted">24/7 Developer Support</small>
                                    </div>
                                </div>

                            </div>

                        </div>
                    </div>

                    <!-- RIGHT: FORM -->
                    <div class="col-lg-6">
                        <div class="contact-card">

                            <div class="text-center mb-4">
                                <img :src="logoSm" height="55" class="rounded mb-3" />

                                <h3 class="fw-bold mb-2">Send us a Message</h3>
                                <p class="text-muted">We typically respond within minutes</p>
                            </div>

                            <b-form @submit.prevent="submitForm">
                                <StatesComponent />

                                <div class="row">
                                    <div class="col-md-6">
                                        <b-form-group class="mb-3">
                                            <label class="form-label fw-semibold">Name</label>
                                            <b-form-input v-model="form.name" placeholder="John Doe"
                                                class="custom-input" />
                                        </b-form-group>
                                    </div>

                                    <div class="col-md-6">
                                        <b-form-group class="mb-3">
                                            <label class="form-label fw-semibold">Email</label>
                                            <b-form-input v-model="form.email" type="email"
                                                placeholder="you@example.com" class="custom-input" />
                                        </b-form-group>
                                    </div>
                                </div>

                                <b-form-group class="mb-3">
                                    <label class="form-label fw-semibold">Subject</label>
                                    <b-form-input v-model="form.subject" placeholder="How can we help?"
                                        class="custom-input" />
                                </b-form-group>

                                <b-form-group class="mb-3">
                                    <label class="form-label fw-semibold">Message</label>
                                    <b-form-textarea v-model="form.message" rows="5" placeholder="Write your message..."
                                        class="custom-input" />
                                </b-form-group>

                                <div class="d-grid">
                                    <b-button type="submit" variant="success" size="lg" class="contact-btn">
                                        Send Message
                                        <i class="fas fa-paper-plane ms-2"></i>
                                    </b-button>
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
import { useApiState } from '@/stores/apiState'

const apiState = useApiState()

const form = reactive({
    name: '',
    email: '',
    subject: '',
    message: ''
})

const submitForm = () => {
    apiState.setSuccess(true)
    apiState.setMessage('Thank you for reaching out! We have received your query and our support team will get back to you shortly.')

    form.name = ''
    form.email = ''
    form.subject = ''
    form.message = ''
}
</script>

<style scoped>
.contact-section {
    min-height: calc(100vh - 80px);
    display: flex;
    align-items: center;
}

.contact-card {
    background: white;
    border-radius: 24px;
    padding: 40px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.06);
}

.custom-input {
    border-radius: 12px;
    border: 1px solid #dfe3e8;
    padding: 12px 14px;
    transition: all 0.25s ease;
}

.custom-input:focus {
    border-color: #20c997;
    box-shadow: 0 0 0 0.2rem rgba(32, 201, 151, 0.15);
}

.contact-btn {
    height: 54px;
    border-radius: 12px;
    font-weight: 600;
}

.contact-icon {
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