<template>
    <div class="bg-gradient-home min-vh-100">
        <!-- Navigation -->
        <nav class="navbar navbar-expand-lg bg-white shadow-sm sticky-top py-2">
            <div class="container">
                <router-link to="/" class="navbar-brand d-flex align-items-center">
                    <img :src="logo" height="40" alt="Demulla" class="me-2" />
                    <span class="fw-bold text-success">Gateway</span>
                </router-link>

                <button class="navbar-toggler border-0" type="button" @click="menuOpen = !menuOpen">
                    <span class="navbar-toggler-icon"></span>
                </button>

                <div class="navbar-collapse" :class="{ show: menuOpen, collapse: !menuOpen }">
                    <ul class="navbar-nav ms-auto align-items-lg-center gap-lg-1">
                        <li class="nav-item"><a class="nav-link" href="/" @click="menuOpen = false">Home</a></li>
                        <li class="nav-item"><a class="nav-link" href="/#features"
                                @click="menuOpen = false">Features</a></li>
                        <li class="nav-item"><a class="nav-link" href="/#benefits"
                                @click="menuOpen = false">Benefits</a></li>
                        <li class="nav-item mt-2 mt-lg-0 ms-lg-2">
                            <router-link to="/auth/signin" class="btn auth-btn-outline w-100" @click="menuOpen = false">
                                Sign In
                            </router-link>
                        </li>
                        <li class="nav-item mt-2 mt-lg-0 ms-lg-2 mb-2 mb-lg-0">
                            <router-link to="/auth/signup" class="btn auth-btn-filled w-100" @click="menuOpen = false">
                                Get Started
                            </router-link>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="container-fluid">
            <slot />
        </div>

        <!-- Footer -->
        <footer class="bg-dark text-white py-4 mt-5">
            <div class="container">
                <div class="row">
                    <div class="col-md-6">
                        <img :src="logo" height="30" alt="Demulla" class="mb-3" />
                        <p class="text-white-50">Simplified M-Pesa Integration by Demulla</p>
                        <p class="text-white-50 small">© 2026 Demulla. All rights reserved.</p>
                    </div>
                    <div class="col-md-3">
                        <h6 class="fw-bold mb-3">Product</h6>
                        <ul class="list-unstyled">
                            <li><a href="#features" class="text-white-50 text-decoration-none">Features</a></li>
                            <li><a href="#benefits" class="text-white-50 text-decoration-none">Benefits</a></li>
                            <li><router-link to="/auth/signin" class="text-white-50 text-decoration-none">Sign
                                    In</router-link></li>
                        </ul>
                    </div>
                    <div class="col-md-3">
                        <h6 class="fw-bold mb-3">Company</h6>
                        <ul class="list-unstyled">
                            <li><a href="https://demulla.co.ke/" class="text-white-50 text-decoration-none"
                                    target="_blank">About Demulla</a></li>
                            <li><a href="/contact-us" class="text-white-50 text-decoration-none">Contact</a></li>
                            <li><a href="/contact-us" class="text-white-50 text-decoration-none">Support</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </footer>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import logo from '@/assets/images/demulla.jpeg';

const menuOpen = ref(false);
</script>

<style scoped>
.bg-gradient-home {
    background: linear-gradient(135deg, #f5f7fa 0%, #ffffff 100%);
}

.navbar-brand:hover {
    opacity: 0.9;
}

.nav-link:hover {
    color: #cc5500 !important;
}

.auth-btn-outline {
    border: 1px solid #20c997;
    color: #20c997;
    background: transparent;
    border-radius: 8px;
    padding: 8px 18px;
    transition: all 0.3s ease;
    display: inline-block;
    text-align: center;
}

.auth-btn-outline:hover {
    color: #cc5500 !important;
    border-color: #cc5500;
    background: rgba(204, 85, 0, 0.05);
}

.auth-btn-filled {
    background: #20c997;
    border: 1px solid #20c997;
    color: white !important;
    border-radius: 8px;
    padding: 8px 18px;
    transition: all 0.3s ease;
    display: inline-block;
    text-align: center;
}

.auth-btn-filled:hover {
    background: #cc5500;
    border-color: #cc5500;
    color: white !important;
}

/* Mobile fixes */
@media (max-width: 991px) {
    .navbar-nav {
        padding: 16px 0;
        gap: 8px;
    }

    .navbar-nav .nav-item {
        width: 100%;
    }

    .navbar-nav .nav-item.ms-2 {
        margin-left: 0 !important;
    }

}

@media (max-width: 991px) {

    .auth-btn-outline,
    .auth-btn-filled {
        width: auto;
        padding: 10px 20px;
        font-size: 14px;
        text-align: center;
    }

    .d-flex.flex-column {
        flex-direction: row !important;
    }
}
</style>