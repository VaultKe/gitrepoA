<template>
  <div>
    <div>
      <b-row class="align-items-center">
        <b-col>
          <b-card-title>{{ title }}</b-card-title>
        </b-col>
      </b-row>
    </div>
    <div class="pt-0">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
type CardPropsType = {
  title: string;
};

defineProps<CardPropsType>();
</script>
