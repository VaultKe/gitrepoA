<template>
  <ul class="navbar-nav mb-auto w-100">
    <template v-for="(item, idx) in visibleMenuItems" :key="idx">
      <li
        v-if="item.isTitle"
        class="menu-label"
        :class="!idx ? 'pt-0 mt-0' : 'mt-2'"
      >
        <small class="label-border" v-if="idx">
          <div class="border_left hidden-xs"></div>
          <div class="border_right"></div>
        </small>
        <span>{{ item.label }} </span>
      </li>

      <template v-else>
        <MenuItemWithChildren
          v-if="item.children"
          :item="item"
          className="nav-item"
          linkClassName="nav-link"
          subMenuClassName="nav flex-column"
        />

        <MenuItem
          v-else
          :item="item"
          linkClassName="nav-link"
          className="nav-item"
        />
      </template>
    </template>
  </ul>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MenuItemType } from "@/types/menu";
import MenuItemWithChildren from "@/components/AppMenu/MenuItemWithChildren.vue";
import MenuItem from "@/components/AppMenu/MenuItem.vue";
import { hasPermission, hasPermissionInModules } from "@/helpers/permissions";

type AppMenuProps = {
  menuItems: Array<MenuItemType>;
};

const props = defineProps<AppMenuProps>();

// Check visibility of a menu item
function isVisible(item: MenuItemType): boolean {
  if (item.permission) {
    return hasPermission(item.permission);
  }

  if (item.children) {
    return item.children.some((child) => isVisible(child));
  }

  return true;
}

const keyModuleMap: Record<string, string[]> = {
  dashboards: [],
  "loan-modules": [
    "Requests & Approval",
    "Accounts And Repayment",
    "Loan Baskets",
    "Approver Checklist",
    "Loan Products And Charges",
  ],
  "finance-modules": [
    "Transactions",
    "Ledger Accounts And Flows",
    "Petty Cash Management",
    "Charge Management",
  ],
  "customer-modules": ["Customer Management", "Customer & Fosa Deposits"],
  "sms-modules": ["SMS And Templates"],
  "asset-modules": ["Assets Management"],
  "hr-modules": ["Employees And Payroll"],
  "reports-modules": ["Reports Management"],
  "settings-modules": ["General Settings", "Settings", "Branch Settings"],
};

// Filter menu items and remove unused titles
const visibleMenuItems = computed(() => {
  const result: MenuItemType[] = [];

  for (let i = 0; i < props.menuItems.length; i++) {
    const item = props.menuItems[i];

    if (item.isTitle) {
      // Check if title has permission (if defined)
      // const hasTitlePermission =
      //   !item.permission || hasPermission(item.permission);

      // Check if any visible non-title item follows
      const hasVisibleNext = props.menuItems
        .slice(i + 1)
        .some((next) => !next.isTitle && isVisible(next));

      const moduleNames = keyModuleMap[item.key];
      //  console.log(`Item Key: ${item.key}`, hasPermissionInModules(moduleNames));
      const hasTitlePermission = moduleNames
        ? hasPermissionInModules(moduleNames)
        : !item.permission || hasPermission(item.permission);

      if (hasTitlePermission && hasVisibleNext) {
        result.push(item);
      }
    } else if (isVisible(item)) {
      result.push(item);
    }
  }

  return result;
});
</script>
