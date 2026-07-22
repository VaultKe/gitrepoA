import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { toggleDocumentAttribute } from "@/helpers/layout";

type LayoutType = {
  theme: "light" | "dark";
  leftSideBarColor: "light" | "dark";
  leftSideBarSize: "default" | "collapsed";
};

const defaultConfig: LayoutType = {
  theme: "light",
  leftSideBarColor: "light",
  leftSideBarSize: "default",
};

export const useLayoutStore = defineStore("layout_store", () => {
  const layout = useLocalStorage<LayoutType>(
    "rizz_nuxt_layout_store",
    defaultConfig,
  );

  const setTheme = (nTheme: LayoutType["theme"]) => {
    layout.value.theme = nTheme;
    toggleDocumentAttribute("data-bs-theme", layout.value.theme);
  };

  const setLeftSideBarColor = (nColor: LayoutType["leftSideBarColor"]) => {
    layout.value.leftSideBarColor = nColor;
    toggleDocumentAttribute("data-startbar", layout.value.leftSideBarColor);
  };

  const setLeftSideBarSize = (nSize: LayoutType["leftSideBarSize"]) => {
    layout.value.leftSideBarSize = nSize;
    toggleDocumentAttribute(
      "data-sidebar-size",
      layout.value.leftSideBarSize,
      "body",
    );
  };

  const reset = () => {
    setTheme(defaultConfig.theme);
    setLeftSideBarColor(defaultConfig.leftSideBarColor);
    setLeftSideBarSize(defaultConfig.leftSideBarSize);
  };

  const init = () => {
    setTheme(layout.value.theme);
    setLeftSideBarColor(layout.value.leftSideBarColor);
    setLeftSideBarSize(layout.value.leftSideBarSize);
  };

  return {
    layout,
    setTheme,
    setLeftSideBarColor,
    setLeftSideBarSize,
    reset,
    init,
  };
});
