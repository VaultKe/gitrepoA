<template>
  <div class="topbar d-print-none">
    <div class="container-xxl">
      <nav class="topbar-custom d-flex justify-content-between" id="topbar-custom">
        <ul class="topbar-item list-unstyled d-inline-flex align-items-center mb-0">
          <li>
            <button class="nav-link mobile-menu-btn nav-icon" id="togglemenu" @click="toggleLeftSideBar">
              <i class="iconoir-menu-scale"></i>
            </button>
          </li>
          <li class="mx-3 welcome-text">
            <h3 class="mb-0 fw-bold text-truncate">
              Hello, {{ user?.first_name }}!
            </h3>
            <!-- <h6 class="mb-0 fw-normal text-muted text-truncate fs-14">Here's your overview this week.</h6> -->
          </li>
        </ul>
        <ul class="topbar-item list-unstyled d-inline-flex align-items-center mb-0">
          <li class="hide-phone app-search">
            <div class="d-flex">
              <div>
                <form role="search">
                  <input type="search" name="search" v-model="params.query" class="form-control top-search mb-0"
                    placeholder="Search customer here..." />
                  <button type="button"><i class="iconoir-search"></i></button>
                </form>
              </div>
            </div>
          </li>

          <li class="topbar-item">
            <a class="nav-link nav-icon" href="javascript:void(0);" id="light-dark-mode" @click="toggleTheme">
              <i class="icofont-sun dark-mode"></i>
              <i class="icofont-moon light-mode"></i>
            </a>
          </li>

          <DropDown is="li" custom-class="topbar-item">
            <a class="nav-link dropdown-toggle arrow-none nav-icon" data-bs-toggle="dropdown" href="#" role="button"
              aria-haspopup="false" aria-expanded="false">
              <i class="icofont-bell-alt"></i>
              <span class="alert-badge"></span>
            </a>
            <div class="dropdown-menu stop dropdown-menu-end dropdown-lg py-0">
              <h5 class="dropdown-item-text m-0 py-3 d-flex justify-content-between align-items-center">
                Notifications
                <a href="#" class="badge text-body-tertiary badge-pill">
                  <i class="iconoir-plus-circle fs-4"></i>
                </a>
              </h5>
              <ul class="nav nav-tabs nav-tabs-custom nav-success nav-justified mb-1">
                <li class="nav-item">
                  <a class="nav-link mx-0" :class="show === 'all-tab' && 'active'" href="#All"
                    @click="show = 'all-tab'">
                    All
                    <b-badge :variant="null" class="bg-primary-subtle text-primary badge-pill ms-1">24</b-badge>
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link mx-0" :class="show === 'projects-tab' && 'active'" href="#Projects"
                    @click="show = 'projects-tab'">
                    Projects
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link mx-0" :class="show === 'teams-tab' && 'active'" href="#Teams"
                    @click="show = 'teams-tab'">
                    Team
                  </a>
                </li>
              </ul>
              <simplebar class="ms-0" style="max-height: 230px" data-simplebar>
                <div class="tab-content" id="myTabContent">
                  <div class="tab-pane fade" :class="show === 'all-tab' && 'show active'" id="All">
                    <a href="#" class="dropdown-item py-3">
                      <small class="float-end text-muted ps-2">2 min ago</small>
                      <div class="d-flex align-items-center">
                        <div class="flex-shrink-0 bg-primary-subtle text-primary thumb-md rounded-circle">
                          <i class="iconoir-wolf fs-4"></i>
                        </div>
                        <div class="flex-grow-1 ms-2 text-truncate">
                          <h6 class="my-0 fw-normal text-dark fs-13">
                            Your order is placed
                          </h6>
                          <small class="text-muted mb-0">Dummy text of the printing and industry.</small>
                        </div>
                      </div>
                    </a>

                    <a href="#" class="dropdown-item py-3">
                      <small class="float-end text-muted ps-2">10 min ago</small>
                      <div class="d-flex align-items-center">
                        <div class="flex-shrink-0 bg-primary-subtle text-primary thumb-md rounded-circle">
                          <i class="iconoir-apple-swift fs-4"></i>
                        </div>
                        <div class="flex-grow-1 ms-2 text-truncate">
                          <h6 class="my-0 fw-normal text-dark fs-13">
                            Meeting with designers
                          </h6>
                          <small class="text-muted mb-0">It is a long established fact that a reader.</small>
                        </div>
                      </div>
                    </a>

                    <a href="#" class="dropdown-item py-3">
                      <small class="float-end text-muted ps-2">40 min ago</small>
                      <div class="d-flex align-items-center">
                        <div class="flex-shrink-0 bg-primary-subtle text-primary thumb-md rounded-circle">
                          <i class="iconoir-birthday-cake fs-4"></i>
                        </div>
                        <div class="flex-grow-1 ms-2 text-truncate">
                          <h6 class="my-0 fw-normal text-dark fs-13">
                            UX 3 Task complete.
                          </h6>
                          <small class="text-muted mb-0">Dummy text of the printing.</small>
                        </div>
                      </div>
                    </a>

                    <a href="#" class="dropdown-item py-3">
                      <small class="float-end text-muted ps-2">1 hr ago</small>
                      <div class="d-flex align-items-center">
                        <div class="flex-shrink-0 bg-primary-subtle text-primary thumb-md rounded-circle">
                          <i class="iconoir-drone fs-4"></i>
                        </div>
                        <div class="flex-grow-1 ms-2 text-truncate">
                          <h6 class="my-0 fw-normal text-dark fs-13">
                            Your order is placed
                          </h6>
                          <small class="text-muted mb-0">It is a long established fact that a reader.</small>
                        </div>
                      </div>
                    </a>

                    <a href="#" class="dropdown-item py-3">
                      <small class="float-end text-muted ps-2">2 hrs ago</small>
                      <div class="d-flex align-items-center">
                        <div class="flex-shrink-0 bg-primary-subtle text-primary thumb-md rounded-circle">
                          <i class="iconoir-user fs-4"></i>
                        </div>
                        <div class="flex-grow-1 ms-2 text-truncate">
                          <h6 class="my-0 fw-normal text-dark fs-13">
                            Payment Successfull
                          </h6>
                          <small class="text-muted mb-0">Dummy text of the printing.</small>
                        </div>
                      </div>
                    </a>
                  </div>
                  <div class="tab-pane fade" :class="show === 'projects-tab' && 'show active'" id="Projects">
                    <a href="#" class="dropdown-item py-3">
                      <small class="float-end text-muted ps-2">40 min ago</small>
                      <div class="d-flex align-items-center">
                        <div class="flex-shrink-0 bg-primary-subtle text-primary thumb-md rounded-circle">
                          <i class="iconoir-birthday-cake fs-4"></i>
                        </div>
                        <div class="flex-grow-1 ms-2 text-truncate">
                          <h6 class="my-0 fw-normal text-dark fs-13">
                            UX 3 Task complete.
                          </h6>
                          <small class="text-muted mb-0">Dummy text of the printing.</small>
                        </div>
                      </div>
                    </a>

                    <a href="#" class="dropdown-item py-3">
                      <small class="float-end text-muted ps-2">1 hr ago</small>
                      <div class="d-flex align-items-center">
                        <div class="flex-shrink-0 bg-primary-subtle text-primary thumb-md rounded-circle">
                          <i class="iconoir-drone fs-4"></i>
                        </div>
                        <div class="flex-grow-1 ms-2 text-truncate">
                          <h6 class="my-0 fw-normal text-dark fs-13">
                            Your order is placed
                          </h6>
                          <small class="text-muted mb-0">It is a long established fact that a reader.</small>
                        </div>
                      </div>
                    </a>

                    <a href="#" class="dropdown-item py-3">
                      <small class="float-end text-muted ps-2">2 hrs ago</small>
                      <div class="d-flex align-items-center">
                        <div class="flex-shrink-0 bg-primary-subtle text-primary thumb-md rounded-circle">
                          <i class="iconoir-user fs-4"></i>
                        </div>
                        <div class="flex-grow-1 ms-2 text-truncate">
                          <h6 class="my-0 fw-normal text-dark fs-13">
                            Payment Successfull
                          </h6>
                          <small class="text-muted mb-0">Dummy text of the printing.</small>
                        </div>
                      </div>
                    </a>
                  </div>
                  <div class="tab-pane fade" :class="show === 'teams-tab' && 'show active'" id="Teams">
                    <a href="#" class="dropdown-item py-3">
                      <small class="float-end text-muted ps-2">1 hr ago</small>
                      <div class="d-flex align-items-center">
                        <div class="flex-shrink-0 bg-primary-subtle text-primary thumb-md rounded-circle">
                          <i class="iconoir-drone fs-4"></i>
                        </div>
                        <div class="flex-grow-1 ms-2 text-truncate">
                          <h6 class="my-0 fw-normal text-dark fs-13">
                            Your order is placed
                          </h6>
                          <small class="text-muted mb-0">It is a long established fact that a reader.</small>
                        </div>
                      </div>
                    </a>

                    <a href="#" class="dropdown-item py-3">
                      <small class="float-end text-muted ps-2">2 hrs ago</small>
                      <div class="d-flex align-items-center">
                        <div class="flex-shrink-0 bg-primary-subtle text-primary thumb-md rounded-circle">
                          <i class="iconoir-user fs-4"></i>
                        </div>
                        <div class="flex-grow-1 ms-2 text-truncate">
                          <h6 class="my-0 fw-normal text-dark fs-13">
                            Payment Successfull
                          </h6>
                          <small class="text-muted mb-0">Dummy text of the printing.</small>
                        </div>
                      </div>
                    </a>
                  </div>
                </div>
              </simplebar>
              <router-link to="/pages/notifications" class="dropdown-item text-center text-dark fs-13 py-2">
                View All <i class="fi-arrow-right"></i>
              </router-link>
            </div>
          </DropDown>

          <DropDown is="li" custom-class="topbar-item">
            <a class="nav-link dropdown-toggle arrow-none nav-icon" data-bs-toggle="dropdown" href="#" role="button"
              aria-haspopup="false" aria-expanded="false">
              <img v-if="user?.profile" :src="user.profile" alt="" class="thumb-lg rounded-circle" />
              <span v-else class="thumb-lg bg-dark-subtle text-success rounded-circle">
                {{ getInitials(user?.name) }}</span>
            </a>
            <div class="dropdown-menu dropdown-menu-end py-0">
              <div class="d-flex align-items-center dropdown-item py-2 bg-secondary-subtle">
                <div class="flex-shrink-0">
                  <img v-if="user?.profile" :src="user.profile" alt="" class="thumb-md rounded-circle" />
                  <span v-else
                    class="thumb-md justify-content-center d-flex align-items-center bg-success-subtle text-success rounded-circle me-2">
                    {{ getInitials(user?.name) }}</span>
                </div>
                <div class="flex-grow-1 ms-2 text-truncate align-self-center">
                  <h6 class="my-0 fw-medium text-dark fs-13">
                    {{ user?.name }}
                  </h6>
                  <small class="text-muted mb-0">{{
                    user?.details?.occupation?.name
                    }}</small>
                </div>
              </div>
              <div class="dropdown-divider mt-0"></div>
              <small class="text-muted px-2 pb-1 d-block">Account</small>
              <router-link class="dropdown-item" :to="{
                name: 'profile.view',
                params: { id: 1 },
              }">
                <i class="las la-user fs-18 me-1 align-text-bottom"></i>
                Profile
              </router-link>

              <!--<small class="text-muted px-2 py-1 d-block">Settings</small>
              <router-link class="dropdown-item" to="/pages/profile">
                <i class="las la-cog fs-18 me-1 align-text-bottom"></i>
                Account Settings
              </router-link>
              <router-link
                class="dropdown-item"
                to="/auth/lock-screen"
                target="_blank"
              >
                <i class="las la-lock fs-18 me-1 align-text-bottom"></i>
                Lock
              </router-link>
              <router-link class="dropdown-item" to="/pages/faqs">
                <i
                  class="las la-question-circle fs-18 me-1 align-text-bottom"
                ></i>
                Help Center
              </router-link>-->
              <div class="dropdown-divider mb-0"></div>
              <a class="dropdown-item text-danger" href="javascript:void(0)" @click.prevent="logout()">
                <i class="las la-power-off fs-18 me-1 align-text-bottom"></i>
                Logout
              </a>
            </div>
          </DropDown>
        </ul>
      </nav>
      <div class="search-results" v-if="results.length">
        <ul class="list-group">
          <li v-for="(r, i) in results" :key="i" class="list-group-item py-1">
            <router-link :to="{
              name: 'customer.view',
              params: { id: r.id },
            }">{{ r.name }} ~ {{ r.phone_number }}</router-link>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, reactive, watch } from "vue";
import { getUser } from '@/helpers/helper'
import simplebar from "simplebar-vue";
import DropDown from "@/components/DropDown.vue";
import { useLayoutStore } from "@/stores/layout";
import usFlag from "@/assets/images/flags/us_flag.jpg";
import spainFlag from "@/assets/images/flags/spain_flag.jpg";
import germanyFlag from "@/assets/images/flags/germany_flag.jpg";
import frenchFlag from "@/assets/images/flags/french_flag.jpg";
import avatar1 from "@/assets/images/users/avatar-1.jpg";
import debounce from "lodash/debounce";
import customerService from "@/api/customer-managament/customerManagementApi.js";
import {
  getInitials,
  formatNumber,
  capitalizeFirstLetter,
} from "@/helpers/helper";

import { useRouter, useRoute } from "vue-router";
import authService from "@/api/auth/authApi.js";
const show = ref("all-tab");
const useLayout = useLayoutStore();
const { layout, setLeftSideBarSize } = useLayout;
const route = useRoute();
const params = reactive({
  query: "" as any,
});

const results = ref([]) as any;

watch(
  () => params.query,
  (current, old) => {
    if (!current || !current.trim()) {
      results.value = [];
      return;
    }
    if (current.length > 2) {
      performSearch(current.trim());
    } else {
      results.value = [];
    }
  }
);

watch(
  () => route.fullPath, // or route.params.id if it's only based on that
  () => {
    results.value = []; // clear results on navigation
    params.query = "";
  }
);

const performSearch = debounce(async (query) => {
  console.log("Searching for:", query);
  // Fetch API or filter logic here
  await fetch();
}, 500);

const toggleTheme = () => {
  if (useLayout.layout.theme === "light") {
    return useLayout.setTheme("dark");
  }
  useLayout.setTheme("light");
};

const user: any = getUser();

const router = useRouter();

const toggleLeftSideBar = () => {
  if (useLayout.layout.leftSideBarSize === "default") {
    return useLayout.setLeftSideBarSize("collapsed");
  }
  if (useLayout.layout.leftSideBarSize === "collapsed") {
    return useLayout.setLeftSideBarSize("default");
  }
};

const resize = () => {
  if (window.innerWidth < 1441) {
    setLeftSideBarSize("collapsed");
  } else {
    setLeftSideBarSize(
      layout.leftSideBarSize === "collapsed"
        ? "default"
        : layout.leftSideBarSize
    );
  }
};

const logout = async () => {
  try {
    await authService.logoutApi();
    router.push({ name: 'auth.signin' });
  } catch (error: any) {
    alert(error.message || 'Something went wrong');
  }
};

const windowScroll = () => {
  const navbar = document.getElementById("topbar-custom");
  if (navbar) {
    if (
      document.body.scrollTop >= 50 ||
      document.documentElement.scrollTop >= 50
    ) {
      navbar.classList.add("nav-sticky");
    } else {
      navbar.classList.remove("nav-sticky");
    }
  }
};

const leftSideBarClick = () => {
  window.addEventListener("click", (e: any) => {
    const startbar = document.getElementById("startbar");
    const togglemenu = document.getElementById("togglemenu");
    if (!(startbar && startbar.contains(e.target))) {
      if (window.innerWidth < 1441) {
        if (togglemenu && togglemenu.contains(e.target)) {
          setLeftSideBarSize("default");
        } else {
          setLeftSideBarSize("collapsed");
        }
      }
    }
  });
};



onMounted(() => {
  useLayout.init();
  resize();
  window.addEventListener("scroll", (ev) => {
    ev.preventDefault();
    windowScroll();
  });
  window.addEventListener("resize", () => {
    resize();
  });
  leftSideBarClick();
});

const fetch = async () => {
  try {
    const { data } = await customerService.fetchSearchCustomers(params);
    results.value = data;
  } catch (err) {
  } finally {
  }
};
</script>

<style scoped>
.search-results {
  margin-top: 10rem;
  width: 300px;
  position: fixed;
  top: -4.5rem;
  right: 14rem;
  z-index: 9999;
  max-height: 80vh;
  overflow-y: scroll;
}
</style>
