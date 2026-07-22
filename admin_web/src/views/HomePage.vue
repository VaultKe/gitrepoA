<template>
    <HomeLayout>
        <!-- Hero Section -->
        <section id="home" class="py-5">
            <div class="container">
                <b-row class="align-items-center min-vh-75">
                    <b-col lg="6">
                        <h1 class="display-4 fw-bold text-dark mb-4">
                            Simplified M-Pesa Integration
                            <span class="text-success d-block">Built for Scale</span>
                        </h1>
                        <p class="lead text-muted mb-4">
                            Plug-and-play M-Pesa gateway with secure credential management, simplified
                            responses, and guaranteed transaction logging. Built by
                            <span class="fw-bold text-success">Demulla</span>, trusted by businesses across
                            Kenya.
                        </p>
                        <div class="d-flex gap-2 gap-sm-3">
                            <router-link to="/auth/signup" class="btn btn-success px-3 px-sm-4 btn-mobile">
                                <i class="fas fa-rocket me-1 me-sm-2"></i>
                                <span class="btn-text-full">Get Started Free</span>
                                <span class="btn-text-short">Get Started</span>
                            </router-link>
                            <a href="#features" class="btn btn-outline-success px-3 px-sm-4 btn-mobile">
                                <span class="btn-text-full">Learn More</span>
                                <span class="btn-text-short">Learn More</span>
                            </a>
                        </div>
                        <div class="mt-4">
                            <small class="text-muted">
                                <i class="fas fa-shield-alt text-success me-2"></i>Secure • Scalable • Simple
                            </small>
                        </div>
                    </b-col>
                    <b-col lg="6">
                        <div class="code-preview p-4 bg-dark text-white rounded shadow-lg">
                            <div class="d-flex mb-3">
                                <span class="badge bg-success me-2">POST</span>
                                <code class="text-white-50">/api/v1/apps/{app_id}/b2c</code>
                            </div>
                            <pre class="text-success mb-0"><code>{
  "amount": 1000,
  "phone_number": "254708374149",
  "callback_url": "https://yourapp.com/webhook"
}

<span class="text-white-50">// ✅ Response - Clean & Simple</span>
{
  "success": true,
  "transaction": {
    "id": "9c8f...",
    "status": "processing"
  }
}</code></pre>
                        </div>
                    </b-col>
                </b-row>
            </div>
        </section>

        <!-- Features Section -->
        <section id="features" class="py-5 bg-light">
            <div class="container">
                <div class="text-center mb-5">
                    <h2 class="display-5 fw-bold">Why Choose Demulla Gateway?</h2>
                    <p class="lead text-muted">Everything you need for seamless M-Pesa integration</p>
                </div>
                <b-row class="g-4">
                    <b-col md="6" lg="3" v-for="(feature, index) in features" :key="index">
                        <b-card class="border-0 shadow-sm h-100 text-center p-3 hover-lift">
                            <div
                                :class="`feature-icon bg-${feature.color} bg-opacity-10 rounded-circle p-3 mx-auto mb-3`">
                                <i :class="`${feature.icon} text-${feature.color} fs-1`"></i>
                            </div>
                            <h5 class="fw-bold">{{ feature.title }}</h5>
                            <p class="text-muted">{{ feature.description }}</p>
                        </b-card>
                    </b-col>
                </b-row>
            </div>
        </section>

        <!-- Benefits Section -->
        <section id="benefits" class="py-5">
            <div class="container">
                <b-row class="align-items-center">
                    <b-col lg="6" class="mb-4 mb-lg-0">
                        <h2 class="display-6 fw-bold mb-4">
                            Built for Developers, <span class="text-success">Loved by Businesses</span>
                        </h2>

                        <div class="benefit-item mb-4" v-for="(benefit, index) in benefits" :key="index">
                            <div class="d-flex">
                                <div class="flex-shrink-0">
                                    <div class="benefit-icon bg-success bg-opacity-10 rounded p-2 me-3">
                                        <i class="fas fa-check-circle text-success fs-4"></i>
                                    </div>
                                </div>
                                <div>
                                    <h5 class="fw-bold">{{ benefit.title }}</h5>
                                    <p class="text-muted">{{ benefit.description }}</p>
                                </div>
                            </div>
                        </div>
                    </b-col>

                    <b-col lg="6">
                        <div class="comparison-card bg-light p-4 rounded shadow">
                            <h4 class="fw-bold mb-4 text-center">Safaricom vs Demulla Gateway</h4>
                            <table class="table table-borderless">
                                <tbody>
                                    <tr v-for="(comparison, index) in comparisons" :key="index">
                                        <td>
                                            <i class="fas fa-times-circle text-danger me-2"></i>{{ comparison.old }}
                                        </td>
                                        <td class="text-end">
                                            <i class="fas fa-check-circle text-success"></i> {{ comparison.new }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </b-col>
                </b-row>
            </div>
        </section>

        <!-- Stats Section -->
        <section id="stats" class="py-5 bg-success text-white">
            <div class="container">
                <b-row class="text-center g-4">
                    <b-col md="3" v-for="(stat, index) in stats" :key="index">
                        <div class="stat-item">
                            <h2 class="display-4 fw-bold">{{ stat.value }}</h2>
                            <p class="text-white-50 mb-0">{{ stat.label }}</p>
                        </div>
                    </b-col>
                </b-row>
            </div>
        </section>

        <!-- CTA Section -->
        <section class="py-5 bg-light">
            <div class="container text-center">
                <h2 class="display-5 fw-bold mb-4">Ready to Simplify Your M-Pesa Integration?</h2>
                <p class="lead text-muted mb-4">Join businesses already using Demulla Gateway</p>
                <router-link to="/auth/signup" class="btn btn-success btn-lg px-5">
                    <i class="fas fa-rocket me-2"></i>Get Started Free
                </router-link>
            </div>
        </section>
    </HomeLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import HomeLayout from '@/layouts/HomeLayout.vue';

const features = ref([
    {
        icon: 'fas fa-shield-alt',
        color: 'success',
        title: 'Secure Credential Management',
        description: 'Your M-Pesa credentials stored securely in Vault. Never worry about credential leaks again.',
    },
    {
        icon: 'fas fa-code',
        color: 'warning',
        title: 'Simplified Responses',
        description: 'Clean, structured JSON responses. No more nested arrays and confusing M-Pesa formats.',
    },
    {
        icon: 'fas fa-database',
        color: 'primary',
        title: 'Transaction Logging',
        description: 'Every transaction logged. Server down? Retrieve transactions later. Never lose data.',
    },
    {
        icon: 'fas fa-plug',
        color: 'danger',
        title: 'Plug & Play',
        description: 'Skip the Safaricom integration headache. Get started in minutes, not days.',
    },
]);

const benefits = ref([
    {
        title: 'No More Credential Headaches',
        description:
            'Managing M-Pesa credentials is a pain. We handle it securely using industry-standard Vault technology. Your secrets stay secret.',
    },
    {
        title: 'Clean, Developer-Friendly APIs',
        description:
            "Safaricom's nested arrays driving you crazy? We transform complex M-Pesa responses into clean, structured JSON you'll actually enjoy working with.",
    },
    {
        title: 'Never Lose a Transaction',
        description:
            'Server down during callback? No problem. We log every transaction with complete audit trails. Retrieve them anytime, even days later.',
    },
    {
        title: '5 Minutes to Your First Transaction',
        description:
            'Skip the weeks of Safaricom integration headaches. Create an app, add credentials, start sending money. That\'s it.',
    }
]);

const comparisons = ref([
    { old: 'Complex nested responses', new: 'Clean JSON' },
    { old: 'Manual credential management', new: 'Vault secured' },
    { old: 'Lost callbacks', new: 'Complete logs' },
    { old: 'Weeks to integrate', new: 'Minutes' },
]);

const stats = ref([
    { value: '250K+', label: 'Transactions Processed' },
    { value: 'KES 5M+', label: 'Total Value Handled' },
    { value: '99.9%', label: 'Uptime' },
    { value: '50+', label: 'Active Clients' },
]);
</script>

<style scoped>
.min-vh-75 {
    min-height: 75vh;
}

.code-preview {
    font-family: 'Courier New', monospace;
}

.hover-lift {
    transition: transform 0.3s ease;
}

.hover-lift:hover {
    transform: translateY(-5px);
}

.feature-icon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.btn-mobile {
    font-size: 0.85rem;
    padding-top: 10px;
    padding-bottom: 10px;
}

.btn-text-short {
    display: none;
}

@media (max-width: 400px) {
    .btn-mobile {
        font-size: 0.75rem;
        padding: 8px 10px;
    }

    .btn-text-full {
        display: none;
    }

    .btn-text-short {
        display: inline;
    }
}

@media (min-width: 401px) {
    .btn-mobile {
        font-size: 0.9rem;
    }
}

@media (min-width: 576px) {
    .btn-mobile {
        font-size: 1rem;
        padding: 10px 24px;
    }
}
</style>