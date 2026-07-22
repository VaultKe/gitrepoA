<template>
  <div class="container-xxl">
    <b-row class="vh-100 d-flex justify-content-center">
      <b-col cols="12" class="align-self-center">
        <b-card-body>
          <b-row>
            <slot />
          </b-row>
        </b-card-body>
      </b-col>
    </b-row>
  </div>
</template>

<script setup lang="ts"></script>
