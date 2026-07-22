import { MENU_ITEMS } from "@/assets/data/menu-items";
import type { MenuItemType } from "@/types/menu";
import type { RouteRecordName } from "vue-router";

let activeMenuItem = {};

const getMatchingMenuItems = (
  data: MenuItemType[],
  currentRouteName: RouteRecordName | null | undefined,
) => {
  const matchingItems: string[] = [];

  const traverse = (item: MenuItemType) => {
    if (
      item.children &&
      item.children.some(
        (child) => child.route?.name && child.route.name === currentRouteName,
      )
    ) {
      matchingItems.push(item.key); // Add parent's key if a child matches
      if (item.parentKey) {
        matchingItems.push(item.parentKey);
      }
    }

    if (item.children) {
      item.children.forEach((child) => traverse(child));
    }
  };

  data.forEach(traverse);

  return matchingItems;
};

export const menuItemActive = (
  key: string,
  currentRouteName: RouteRecordName | null | undefined,
) => {
  activeMenuItem = getMatchingMenuItems(MENU_ITEMS, currentRouteName);
  return activeMenuItem && Object.values(activeMenuItem).includes(key);
};
