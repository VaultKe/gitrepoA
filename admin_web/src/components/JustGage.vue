<template>
  <component
    :is="is ?? 'div'"
    :id="id"
    class="gauge"
    :class="className"
    v-bind="$attrs"
  ></component>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import JustGage from "justgage";

type JustGagePropsType = {
  is?: string;
  id: string;
  options?: any;
  className?: string;
};

const props = defineProps<JustGagePropsType>();

onMounted(() => {
  const justgage = new JustGage({
    id: props.id,
    ...props.options,
  });
});
</script>
