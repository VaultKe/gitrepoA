<template>
  <li :class="className" v-if="filteredChildren.length > 0">
    <a
      class="nav-link"
      :class="{ active: isActive }"
      @click="toggleMenu"
      role="button"
      :aria-expanded="visible.toString()"
      :aria-controls="item.key"
    >
      <i class="menu-icon" :class="item.icon" v-if="item.icon" />
      <span>{{ item.label }}</span>

      <b-badge
        v-if="item.badge"
        class="rounded text-success bg-success-subtle ms-1"
      >
        {{ item.badge.text }}
      </b-badge>
      <!-- Chevron Icon -->
      <i
        :class="visible ? 'iconoir-nav-arrow-down' : 'iconoir-nav-arrow-right'"
      ></i>
    </a>

    <b-collapse :id="item.key" :visible="visible">
      <ul :class="subMenuClassName">
        <template v-for="(link, idx) in filteredChildren || []" :key="idx">
          <MenuItemWithChildren
            v-if="link.children"
            :item="link"
            className="nav-item"
            subMenuClassName="nav flex-column"
          />
          <MenuItem
            v-else
            :item="link"
            className="nav-item"
            linkClassName="nav-link"
          />
        </template>
      </ul>
    </b-collapse>
  </li>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import MenuItem from "@/components/AppMenu/MenuItem.vue";
import MenuItemWithChildren from "@/components/AppMenu/MenuItemWithChildren.vue";
import { menuItemActive } from "@/components/AppMenu/menuActivation";
import type { SubMenus } from "@/types/menu";
import { hasPermission } from "@/helpers/permissions";

const props = defineProps<SubMenus>();

const route = useRoute();
const visible = ref(false);
const wasClicked = ref(false); // track manual toggle intent

const isActive = computed(() => {
  return menuItemActive(props.item.key, route.name);
});

const filteredChildren = computed(() => {
  return (props.item.children || []).filter((child) => {
    return !child.permission || hasPermission(child.permission);
  });
});

const toggleMenu = () => {
  visible.value = !visible.value;
  wasClicked.value = true;
};

onMounted(() => {
  visible.value = isActive.value;
});

watch(
  () => route.name,
  () => {
    // Only auto-toggle if the user didn't manually click
    if (!wasClicked.value) {
      visible.value = isActive.value;
    }

    // Reset manual toggle tracking after route navigation settles
    setTimeout(() => {
      wasClicked.value = false;
    }, 200);

    // document.body.scrollTop = 0;
    // document.documentElement.scrollTop = 0;
  }
);
</script>

<style scoped>
.iconoir-nav-arrow-right,
.iconoir-nav-arrow-down {
  font-size: 1rem;
}
</style>
