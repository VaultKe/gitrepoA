<template>
  <div class="startbar d-print-none" id="startbar">
    <div class="brand">
      <LogoBox />
    </div>
    <div class="startbar-menu">
      <simplebar class="startbar-collapse" id="startbarCollapse" data-simplebar>
        <div class="d-flex align-items-start flex-column w-100">
          <AppMenu :menu-items="getMenuItems()" />
        </div>
      </simplebar>
    </div>
  </div>
  <div class="startbar-overlay d-print-none"></div>
</template>
<script setup lang="ts">
import simplebar from "simplebar-vue";
import { getMenuItems } from "@/helpers/menu";
import LogoBox from "@/components/LogoBox.vue";
</script>
