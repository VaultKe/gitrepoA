import { useState, useEffect, useMemo, useCallback } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useApp } from "../context/AppContext";
import { useChamaContext } from "../context/ChamaContext";
import {
  getThemeColors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../utils/theme";
import ApiService from "../services/api";

const createTableStyles = (colors, spacing, typography, shadows) => ({
  tableContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  nameCell: {
    flex: 2.5,
    alignItems: "flex-start",
  },
  amountCell: {
    flex: 1.2,
  },
  dateCell: {
    flex: 1.5,
  },
  tableHeaderText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    fontSize: 12,
    textAlign: "center",
  },
  tableCellText: {
    fontSize: 12,
    color: colors.text,
    textAlign: "center",
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  typeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.xs,
  },
  nameText: {
    fontWeight: typography.fontWeight.medium,
    textAlign: "left",
  },
});

const useWelfareContributionsScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);

  // welfareRequestId is the ID of the welfare_request record (not a welfare_contribution id)
  const welfareRequestId = route?.params?.welfareRequestId ?? null;
  const chamaId = route?.params?.chamaId ?? currentChamaId;

  // ── State ────────────────────────────────────────────────────────────────────
  const [welfareRequest, setWelfareRequest] = useState(null);
  const [allContributions, setAllContributions] = useState([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [contributionsLoading, setContributionsLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 15;

  const anyLoading = requestLoading || contributionsLoading;

  // ── Data helpers ─────────────────────────────────────────────────────────────
  /**
   * Load the welfare request details and cross-validate / supplement its
   * `totalContributions` & `contributionCount` with the live counts returned by
   * getWelfareContributions so the header/progress bar is always accurate.
   */
  const loadWelfareRequestDetails = async () => {
    if (!welfareRequestId) return;
    try {
      setRequestLoading(true);

      // Fetch request summary and live contribution records in parallel
      const [requestsResponse, contributionsResponse] = await Promise.all([
        ApiService.getWelfareRequests(chamaId, 500, 0),
        ApiService.getWelfareContributions(welfareRequestId, 500, 0),
      ]);

      let request = null;

      // 1. Find the matching welfare request from chama-level list
      if (requestsResponse?.success) {
        request =
          requestsResponse.data?.find((r) => r.id === welfareRequestId) ||
          null;
      }

      // 2. Override totals with live aggregated data from welfare_contributions
      if (contributionsResponse?.success) {
        const contributions = contributionsResponse.data || [];
        const total = contributions.reduce(
          (sum, c) => sum + (parseFloat(c.amount) || 0),
          0,
        );

        if (request) {
          request = {
            ...request,
            totalContributions: total,
            contributionCount: contributions.length,
            remainingAmount: Math.max(0, (request.amount || 0) - total),
            progressPercentage:
              request.amount > 0
                ? Math.min(100, (total / request.amount) * 100)
                : 0,
          };
        }
      }

      // 3. Fallback stub if the chama-level list didn't return anything
      if (
        !request &&
        contributionsResponse?.success &&
        contributionsResponse.data?.length > 0
      ) {
        const contributions = contributionsResponse.data || [];
        const total = contributions.reduce(
          (sum, c) => sum + (parseFloat(c.amount) || 0),
          0,
        );
        request = {
          id: welfareRequestId,
          title: (
            contributionsResponse?.data?.[0]?.message || "Welfare Fund"
          ).replace("Welfare support for: ", ""),
          amount: total > 0 ? total * 2 : 1000,
          totalContributions: total,
          contributionCount: contributions.length,
          remainingAmount: total,
          progressPercentage: 50,
          category: "medical",
          urgency: "medium",
          status: "approved",
          beneficiary: { fullName: "Unknown" },
          requester: { fullName: "Unknown" },
        };
      }

      setWelfareRequest(request);
    } catch (error) {
      // eslint-disable-next-line no-alert
      Alert.alert("Error", "Failed to load welfare request details.");
    } finally {
      setRequestLoading(false);
    }
  };

  /**
   * Load individual welfare_contribution records for this welfare request.
   * Called on mount (via useEffect) and every time the screen regains focus
   * (via useFocusEffect) so newly made contributions are immediately visible.
   */
  const loadContributions = async () => {
    // ── Primary guard — never call the API without an ID ───────────────────────
    if (!welfareRequestId) {
      console.warn(
        "⚠️ [WelfareContributionsScreen] loadContributions: welfareRequestId is undefined – aborting",
      );
      setAllContributions([]);
      setTotalItems(0);
      setTotalPages(1);
      setCurrentPage(1);
      return;
    }

    try {
      setContributionsLoading(true);

      const response =
        await ApiService.getWelfareContributions(welfareRequestId);

      if (response?.success) {
        const contribs = Array.isArray(response.data) ? response.data : [];
        setAllContributions(contribs);
        setTotalItems(contribs.length);
        setTotalPages(Math.max(1, Math.ceil(contribs.length / pageSize)));
        setCurrentPage(1);
      } else {
        console.warn(
          "⚠️ [WelfareContributionsScreen] getWelfareContributions returned success=false:",
          response,
        );
        setAllContributions([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error(
        "❌ [WelfareContributionsScreen] loadContributions threw:",
        error,
      );
      setAllContributions([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setContributionsLoading(false);
    }
  };

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (welfareRequestId) {
      loadWelfareRequestDetails();
      loadContributions();
    } else {
      console.warn(
        "⚠️ [WelfareContributionsScreen] useEffect: welfareRequestId is null",
      );
    }
  }, [welfareRequestId]);

  // Re-fetch contributions whenever the screen gains focus (e.g. after returning
  // from ContributeScreen). useFocusEffect is from @react-navigation/native.
  useFocusEffect?.(
    // optional chaining on the singleton = safe on web where it's undefined
    useCallback(() => {
      if (welfareRequestId) {
        loadContributions();
      }
    }, [welfareRequestId]),
  );

  // ── Derived data ─────────────────────────────────────────────────────────────
  const contributions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const slice = allContributions.slice(startIndex, startIndex + pageSize);
    return slice;
  }, [allContributions, currentPage, pageSize]);

  // ── Formatters ───────────────────────────────────────────────────────────────
  const formatCurrency = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return "KES 0";
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown Date";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Invalid Date";
    }
  };

  const getContributorDisplayName = (contribution) => {
    if (!contribution?.contributor) return "Unknown Contributor";
    const contributor = contribution.contributor;
    // The backend flattens contributor fields first_name/last_name at the top level;
    // it may also nest a `user` sub-object. Handle both shapes.
    const userData = contributor.user || contributor;
    const firstName =
      userData.first_name || contributor.first_name || userData.firstName || "";
    const lastName =
      userData.last_name || contributor.last_name || userData.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return (
      fullName ||
      userData.name ||
      contributor.name ||
      contributor.email?.split("@")[0] ||
      "Unknown Contributor"
    );
  };

  return {
    welfareRequestId,
    chamaId,
    colors,
    tableStyles,
    welfareRequest,
    allContributions,
    requestLoading,
    contributionsLoading,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    anyLoading,
    contributions,
    loadWelfareRequestDetails,
    loadContributions,
    formatCurrency,
    formatDate,
    getContributorDisplayName,
    navigation,
    setCurrentPage,
    setTotalPages,
    setTotalItems,
    setAllContributions,
    setRequestLoading,
    setContributionsLoading,
  };
};

export default useWelfareContributionsScreen;
