// composables/useTimeAgo.js
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

import { ref, onMounted, onUnmounted } from "vue";

export function useTimeAgo(date) {
  const timeAgo = ref(dayjs(date).fromNow());

  let interval = null;
  onMounted(() => {
    interval = setInterval(() => {
      timeAgo.value = dayjs(date).fromNow();
    }, 60000); // update every minute
  });

  onUnmounted(() => {
    clearInterval(interval);
  });

  return timeAgo;
}
