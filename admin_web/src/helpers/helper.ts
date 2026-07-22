import CryptoJS from "crypto-js";
import _ from "lodash";
export const formatDate = (dateStr: string, type = false) => {
  const date = new Date(dateStr);
  if (type) {
    return date.toLocaleString("en-GB", {
      weekday: "short", // 'Mon', 'Tue', etc.
      year: "numeric", // '2025'
      month: "short", // 'Mar'
      day: "numeric", // '9'
      hour: "2-digit", // '23'
      minute: "2-digit", // '17'
      second: "2-digit", // '21'
    });
  } else {
    return date.toLocaleString("en-GB", {
      weekday: "short", // 'Mon', 'Tue', etc.
      year: "numeric", // '2025'
      month: "short", // 'Mar'
      day: "numeric", // '9'
      // hour: "2-digit", // '23'
      // minute: "2-digit", // '17'
      // second: "2-digit", // '21'
    });
  }
};

export const getDeviceInfo = () => {
  const nav = navigator as any; // bypass TS type checking for non-standard properties

  return {
    user_agent: nav.userAgent,
    platform: nav.platform,
    productSub: nav.productSub,
    product: nav.product,
    language: nav.language,
    screen: `${window.screen.width}x${window.screen.height}`,
    color_depth: window.screen.colorDepth,
    pixel_ratio: window.devicePixelRatio || 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hardware_concurrency: nav.hardwareConcurrency || null,
    device_memory: nav.deviceMemory || null,
  };
};

export const roundTo = (num: any, decimal: number) => {
  const factor = Math.pow(10, decimal);
  return Math.round(num * factor) / factor;
};

export const getUser = () => {
  let user = localStorage.getItem("user_data") || null;
  if (user) {
    user = JSON.parse(decryptStr(user));
  }
  return user;
};

export const isImage = (file: { url: string }) => {
  const ext = file.url.split(".").pop()?.toLowerCase().split("?")[0];
  return ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext || "");
};

export const formatMoney = (amount: any) => {
  if (isNaN(amount)) return "0.00"; // handle invalid input
  return Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const getAssetStatus = (status: any) => {
  if (typeof status === "string" && status.includes("_")) {
    const parts = status.split("_");
    if (parts.length === 2) {
      return parts.join(" ");
    }
  }
  return status;
};

export const comingSoon = () => {
  alert("Coming soon");
};

export const resetForm = (obj: any) => {
  for (const key in obj) {
    const value = obj[key];

    if (value instanceof File) {
      obj[key] = null; // or '' depending on your design
      continue;
    }

    if (Array.isArray(value)) {
      if (
        value.length > 0 &&
        typeof value[0] === "object" &&
        value[0] !== null
      ) {
        obj[key] = value.map((item: any) => {
          const newItem: any = {};
          for (const subKey in item) {
            const subValue = item[subKey];
            newItem[subKey] =
              typeof subValue === "number"
                ? null
                : typeof subValue === "object" && subValue !== null
                  ? resetForm({ ...subValue })
                  : "";
          }
          return newItem;
        });
      } else {
        obj[key] = [];
      }
    } else if (value !== null && typeof value === "object") {
      resetForm(value);
    } else if (typeof value === "number") {
      obj[key] = null;
    } else {
      obj[key] = "";
    }
  }

  return obj;
};

export const getInitials = (name: string) => {
  if (!name) return "";

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }

  const first = parts[0][0].toUpperCase();
  const last = parts[parts.length - 1][0].toUpperCase();

  return first + last;
};

export const formatNumber = (num: number) => {
  if (typeof num !== "number") {
    num = parseFloat(num);
  }

  if (isNaN(num)) return "";

  return num.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
};

export const capitalizeFirstLetter = (word: string): string => {
  if (!word) return "";

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
};

export const encryptStr = async (str: string) => {
  const secret = "7e64020c-fb0a-4a41-aff7-23d2799f99c9";
  return CryptoJS.AES.encrypt(str, secret).toString();
};

export const decryptStr = (str: string) => {
  const secret = "7e64020c-fb0a-4a41-aff7-23d2799f99c9";
  const bytes = CryptoJS.AES.decrypt(str, secret);
  return bytes.toString(CryptoJS.enc.Utf8);
};

export const encryptData = async (data: any) => {
  const key = CryptoJS.enc.Utf8.parse(
    "d4b6f2e8f1c7a304b7a6d0cbe9fabcfe32c1d4e5a1b7c8fdd2e3a9b1c7e6f203",
  ); // 32-byte key for AES-256
  const iv = CryptoJS.enc.Utf8.parse("1234567890123456"); // 16-byte IV
  const cipher = "AES-256-CBC";

  return CryptoJS.AES.encrypt(JSON.stringify(data), key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
};

export const resolveLevels = (level: string) => {
  switch (level) {
    case "first":
      return "First Approval";
      break;
    case "second":
      return "Second Approval";
      break;

    case "final":
      return "Final Approval";
      break;
    default:
      break;
  }
};

export const getRowClass = (date: any) => {
  if (!date) return "";

  const today = new Date();
  const interactionDate = new Date(date);

  today.setHours(0, 0, 0, 0);
  interactionDate.setHours(0, 0, 0, 0);

  if (interactionDate < today) {
    return "bg-danger text-white";
  } else if (interactionDate.getTime() === today.getTime()) {
    return "bg-warning";
  } else {
    return "";
  }
};

export const formatLabel = (str: string) => {
  return _.startCase(_.toLower(str));
};

export const getTotalValues = (
  entries: { actual_value: number | string }[],
) => {
  return entries.reduce((sum, entry) => {
    const value = Number(entry.actual_value) || 0;
    return sum + value;
  }, 0);
};
