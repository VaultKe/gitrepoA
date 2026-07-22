<template>
  <div class="spinner-overlay">
    <b-spinner variant="primary" />
  </div>
</template>

<style scoped>
.spinner-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 1);
  z-index: 1050;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
