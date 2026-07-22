<template>
  <li :class="className">
    <MenuItemLink :item="item" :class-name="linkClassName" />
  </li>
</template>

<script setup lang="ts">
import MenuItemLink from "@/components/AppMenu/MenuItemLink.vue";
import type { SubMenus } from "@/types/menu";

defineProps<SubMenus>();
</script>
