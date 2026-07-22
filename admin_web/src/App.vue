<template>
  <div>
    <RouterView />
    <!-- Only show inactivity warning if user was authenticated but became inactive -->
  </div>
</template>

<script setup lang="ts">
import { RouterView } from "vue-router";
import { useLayoutStore } from "@/stores/layout";
import { onMounted, computed, watch, ref } from "vue";

onMounted(() => {
  useLayoutStore().init();
});

</script>

<style scoped>
/* Inactivity warning styles */
.inactivity-warning {
  position: fixed;
  top: 20px;
  right: 20px;
  background: linear-gradient(135deg, #ff6b6b, #ee5a52);
  color: white;
  padding: 16px;
  border-radius: 8px;
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  max-width: 350px;
  min-width: 300px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  animation: slideInBounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.warning-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
}

.warning-icon {
  font-size: 24px;
  flex-shrink: 0;
  margin-top: 2px;
}

.warning-text {
  flex: 1;
}

.warning-text p {
  margin: 0;
  line-height: 1.4;
}

.warning-text p:first-child {
  font-weight: 600;
  margin-bottom: 4px;
}

.warning-text p:last-child {
  font-size: 14px;
  opacity: 0.9;
}

.dismiss-btn {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
  flex-shrink: 0;
  opacity: 0.8;
}

.dismiss-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
  opacity: 1;
  transform: scale(1.1);
}

.dismiss-btn:active {
  transform: scale(0.95);
}

@keyframes slideInBounce {
  0% {
    transform: translateX(100%) scale(0.8);
    opacity: 0;
  }

  60% {
    transform: translateX(-10px) scale(1.05);
    opacity: 1;
  }

  100% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
}

/* Fade out animation when warning is dismissed */
.inactivity-warning.dismissing {
  animation: fadeOut 0.3s ease-out forwards;
}

@keyframes fadeOut {
  to {
    opacity: 0;
    transform: translateX(100%) scale(0.8);
  }
}

/* nprogress custom styles */
#nprogress {
  pointer-events: none;
}

#nprogress .bar {
  background: #29d;
  position: fixed;
  z-index: 1031;
  top: 0;
  left: 0;
  width: 100%;
  height: 6px;
}

#nprogress .spinner {
  position: fixed !important;
  top: 25% !important;
  left: 60% !important;
  transform: translateX(-25%) !important;
  z-index: 1031;
}

#nprogress .spinner-icon {
  width: 40px;
  height: 40px;
  box-sizing: border-box;
  border: solid 4px transparent;
  border-top-color: #29d;
  border-left-color: #29d;
  border-radius: 50%;
  animation: nprogress-spinner 400ms linear infinite;
}

@keyframes nprogress-spinner {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>