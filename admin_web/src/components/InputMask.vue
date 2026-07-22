<template>
  <b-form-input type="text" :id="id" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import Inputmask from "inputmask";

type InputMaskPropsType = {
  is?: string;
  id: string;
  mask: string;
  options?: object;
};

const props = defineProps<InputMaskPropsType>();

onMounted(() => {
  new Inputmask({ mask: props.mask, ...props.options }).mask(`#${props.id}`);
});
</script>
