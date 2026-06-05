import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { useChamaContext } from "../../../context/ChamaContext";
import {
  getThemeColors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../../utils/theme";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import ApiService from "../../../services/api";

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
    fontSize: 9,
    textAlign: "center",
  },
  tableCellText: {
    fontSize: 8.5,
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

const WelfareContributionsScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
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
    React.useCallback(() => {
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
      userData.email?.split("@")[0] ||
      "Unknown Contributor"
    );
  };

  // ── Loading / missing-request guard ─────────────────────────────────────────
  if (!welfareRequestId) {
    console.warn(
      "⚠️ WelfareContributionsScreen: welfareRequestId is null — rendering LoadingSpinner",
    );
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  // When both the welfare-request query returned nothing for this fund and no
  // contribution records were found, show the "not found" empty state.
  if (!welfareRequest && allContributions.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.errorState}>
          <Ionicons
            name="heart-outline"
            size={64}
            color={colors.textTertiary}
          />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Welfare Request Not Found
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load welfare request details
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.white }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Handle case where we have contribution data but no welfare request details yet
  // Show loading state until we can construct the request from contribution data
  if (!welfareRequest && allContributions.length > 0 && anyLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  // Handle loading states
  if (anyLoading && !welfareRequest && allContributions.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  // Handle case where we have contribution data but no welfare request details yet
  // Show loading state until we can construct the request from contribution data
  if (!welfareRequest && allContributions.length > 0 && anyLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  // When both the welfare-request query returned nothing for this fund and no
  // contribution records were found, show the "not found" empty state.
  if (!welfareRequest && allContributions.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.errorState}>
          <Ionicons
            name="heart-outline"
            size={64}
            color={colors.textTertiary}
          />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Welfare Request Not Found
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load welfare request details
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.white }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!welfareRequest && !allContributions.length) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.errorState}>
          <Ionicons
            name="heart-outline"
            size={64}
            color={colors.textTertiary}
          />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Welfare Request Not Found
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load welfare request details
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.white }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (anyLoading && !welfareRequest && allContributions.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

   if (!welfareRequest && !allContributions.length) {
     return (
       <SafeAreaView
         style={[styles.container, { backgroundColor: colors.background }]}
       >
         <View style={styles.emptyState}>
           <Ionicons
             name="heart-outline"
             size={64}
             color={colors.textTertiary}
           />
           <Text style={[styles.errorTitle, { color: colors.text }]}>
             Welfare Request Not Found
           </Text>
           <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
             Unable to load welfare request details
           </Text>
           <TouchableOpacity
             style={[styles.backButton, { backgroundColor: colors.primary }]}
             onPress={() => navigation.goBack()}
           >
             <Text style={[styles.backButtonText, { color: colors.white }]}>
               Go Back
             </Text>
           </TouchableOpacity>
         </View>
       </SafeAreaView>
     );
   }

   // Handle case where we have contribution data but no welfare request details and not loading
   if (!welfareRequest && allContributions.length > 0 && !anyLoading) {
     return (
       <SafeAreaView
         style={[styles.container, { backgroundColor: colors.background }]}
       >
         <View style={styles.errorState}>
           <Ionicons
             name="heart-outline"
             size={64}
             color={colors.textTertiary}
           />
           <Text style={[styles.errorTitle, { color: colors.text }]}>
             Welfare Request Not Found
           </Text>
           <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
             Unable to load welfare request details
           </Text>
           <TouchableOpacity
             style={[styles.backButton, { backgroundColor: colors.primary }]}
             onPress={() => navigation.goBack()}
           >
             <Text style={[styles.backButtonText, { color: colors.white }]}>
               Go Back
             </Text>
           </TouchableOpacity>
         </View>
       </SafeAreaView>
     );
   }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.headerContent}>
            <View style={styles.requestIcon}>
              <Ionicons name="heart" size={32} color={colors.primary} />
            </View>
         <View style={styles.requestInfo}>
           <Text
             style={[styles.requestTitle, { color: colors.text }]}
             numberOfLines={2}
           >
             Contributions to {welfareRequest ? welfareRequest.title : "Welfare Fund"}
           </Text>
           <Text style={[styles.requestAmount, { color: colors.success }]}>
             Target: {formatCurrency(welfareRequest ? welfareRequest.amount : 0)}
           </Text>
           <Text
             style={{
               fontSize: typography.fontSize.sm,
               color: colors.textSecondary,
             }}
           >
             {(welfareRequest && welfareRequest.contributionCount) || 0} contributor
             {((welfareRequest && welfareRequest.contributionCount) || 0) !== 1 ? "s" : ""}{" "}
             &bull; {formatCurrency((welfareRequest && welfareRequest.totalContributions) || 0)}{" "}
             raised
           </Text>
         </View>
          </View>
        </View>

        {/* Contribution Details table */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, marginBottom: spacing.md },
          ]}
        >
          Contribution Details
        </Text>
        <View style={styles.contributionsTable}>
          {/* Table header */}
          <View style={tableStyles.tableHeader}>
            <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
              <Text
                style={[tableStyles.tableHeaderText, { textAlign: "left" }]}
              >
                Contributor
              </Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
              <Text style={tableStyles.tableHeaderText}>Amount</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
              <Text style={tableStyles.tableHeaderText}>Date</Text>
            </View>
          </View>

          {/* Table body */}
          {contributions.length > 0 ? ( // Render rows when we have real data
            contributions.map((contribution, index) => (
              <View
                key={contribution.id}
                style={[
                  tableStyles.tableRow,
                  index % 2 === 0
                    ? { backgroundColor: colors.background }
                    : { backgroundColor: colors.surface },
                ]}
              >
                {/* Contributor */}
                <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
                  <View style={tableStyles.nameContainer}>
                    <View
                      style={[
                        tableStyles.typeIcon,
                        { backgroundColor: colors.primary + "20" },
                      ]}
                    >
                      <Ionicons
                        name="person"
                        size={12}
                        color={colors.primary}
                      />
                    </View>
                    <Text
                      style={[tableStyles.tableCellText, tableStyles.nameText]}
                      numberOfLines={1}
                    >
                      {getContributorDisplayName(contribution)}
                    </Text>
                  </View>
                </View>

                {/* Amount */}
                <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
                  <Text
                    style={[
                      tableStyles.tableCellText,
                      {
                        fontWeight: typography.fontWeight.medium,
                        color: colors.success,
                      },
                    ]}
                  >
                    {formatCurrency(contribution.amount)}
                  </Text>
                </View>

                {/* Date */}
                <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
                  <Text style={tableStyles.tableCellText}>
                    {formatDate(
                      contribution.createdAt || contribution.created_at,
                    )}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            /* Empty state – no contribution records yet */
            <View
              style={{ paddingVertical: spacing.xxxl, alignItems: "center" }}
            >
              <Ionicons
                name="wallet-outline"
                size={48}
                color={colors.textTertiary}
              />
              <Text
                style={[
                  styles.emptyTitle,
                  { color: colors.text, marginTop: spacing.md },
                ]}
              >
                No Contributions Yet
              </Text>
              <Text
                style={[
                  styles.emptySubtitle,
                  { color: colors.textSecondary, textAlign: "center" },
                ]}
              >
                Be the first to contribute to this welfare request
              </Text>
            </View>
          )}

          {/* Pagination */}
          {totalItems > pageSize && (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  currentPage === 1 && styles.paginationButtonDisabled,
                ]}
                onPress={() =>
                  currentPage > 1 && setCurrentPage(currentPage - 1)
                }
                disabled={currentPage === 1}
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color={
                    currentPage === 1 ? colors.textTertiary : colors.primary
                  }
                />
              </TouchableOpacity>

              <Text style={styles.paginationInfo}>
                Page {currentPage} of {totalPages} ({totalItems} total)
              </Text>

              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  currentPage === totalPages && styles.paginationButtonDisabled,
                ]}
                onPress={() =>
                  currentPage < totalPages && setCurrentPage(currentPage + 1)
                }
                disabled={currentPage === totalPages}
              >
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={
                    currentPage === totalPages
                      ? colors.textTertiary
                      : colors.primary
                  }
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1, padding: spacing.md },
  contributionsTable: { marginTop: spacing.md },
  header: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  headerContent: { flexDirection: "row", alignItems: "center" },
  requestIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.lg,
  },
  requestInfo: { flex: 1 },
  requestTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  requestAmount: { fontSize: typography.fontSize.sm },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xl,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: "#f5f5f5",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    marginTop: spacing.sm,
  },
  paginationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  paginationButtonDisabled: { opacity: 0.5 },
  paginationInfo: {
    fontSize: typography.fontSize.sm,
    color: "#6b7280",
    fontWeight: typography.fontWeight.medium,
    minWidth: 60,
    textAlign: "center",
  },
});

export default WelfareContributionsScreen;
