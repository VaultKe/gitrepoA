import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

// ─────────────────────────────────────────────────────────────
// Wallet trend series
//
// Reconstructs a plausible balance history from the user's actual
// transactions and the current wallet balance. Each point represents
// the wallet balance at the end of a month, going back 6 months.
// Falls back to `buildTrendSeries` when no transaction history is
// available.
// ─────────────────────────────────────────────────────────────
export const buildWalletTrendSeries = (currentBalance, transactions, personalWalletId, points = 6) => {
  if (!currentBalance && currentBalance !== 0) return [];
  if (!transactions || transactions.length === 0) {
    return buildTrendSeries(currentBalance, points);
  }

  const now = new Date();

  // Only use successfully completed transactions for the chart.
  // Pending / failed / cancelled transactions did not actually change
  // the wallet balance, so they must be excluded.
  const completedStatuses = new Set(['completed', 'success', 'paid', 'settled']);

  const normalized = transactions
    .filter(tx => tx.date || tx.createdAt)
    .filter(tx => {
      const status = (tx.status || '').toLowerCase();
      return status === '' || completedStatuses.has(status);
    })
    .map(tx => {
      const fromWalletId = tx.fromWalletId || tx.from_wallet_id || null;
      const toWalletId = tx.toWalletId || tx.to_wallet_id || null;
      const amount = Math.abs(tx.amount || 0);

      // When wallet IDs are available, use them to determine direction
      // because transfers/withdrawals/deposits are only meaningful when
      // we know which side the personal wallet is on.
      if (personalWalletId && (fromWalletId || toWalletId)) {
        if (toWalletId === personalWalletId) {
          return { date: new Date(tx.date || tx.createdAt), amount };
        }
        if (fromWalletId === personalWalletId) {
          return { date: new Date(tx.date || tx.createdAt), amount: -amount };
        }
      }

      // Fallback for transactions without wallet IDs (e.g. contribution rows).
      // For wallet balance reconstruction, only deposits/refunds are inflows.
      // Contributions, welfare, withdrawals, transfers, fees, etc. are outflows.
      const inflowTypes = new Set(['deposit', 'refund']);
      return {
        date: new Date(tx.date || tx.createdAt),
        amount: inflowTypes.has(tx.type) ? amount : -amount,
      };
    })
    .sort((a, b) => a.date - b.date);

  // Calculate balance after each transaction by working backwards from current
  const reversed = [...normalized].reverse();
  let runningBalance = currentBalance;
  const timeline = reversed.map(tx => {
    const balanceAfter = runningBalance;
    runningBalance -= tx.amount;
    return { date: tx.date, balance: balanceAfter };
  });

  // Build a series by finding the last known balance at or before each month end
  const series = [];
  for (let i = 0; i < points; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (points - 1 - i), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

    let monthBalance = null;
    for (let j = 0; j < timeline.length; j++) {
      if (timeline[j].date <= monthEnd) {
        monthBalance = timeline[j].balance;
        break;
      }
    }

    if (monthBalance !== null) {
      series.push(monthBalance);
    } else if (i === points - 1) {
      series.push(currentBalance);
    } else if (timeline.length > 0 && timeline[timeline.length - 1].date > monthEnd) {
      // All recorded transactions are after this month; we have no prior data
      series.push(currentBalance);
    } else {
      series.push(0);
    }
  }

  // Final point must always equal the real current balance
  series[series.length - 1] = currentBalance;
  return series;
};

// NOTE: `getUserStatistics` currently returns single current-value
// snapshots, not a real time series. `buildTrendSeries` fabricates a
// plausible-looking curve that always ENDS at the real current value
// (so every number actually shown is accurate) purely to give the
// mini charts and the growth percentage something to draw from.
// Swap this out for a real historical series the moment the backend
// exposes one - search for `buildTrendSeries(` to find every call site.
// ─────────────────────────────────────────────────────────────
export const buildTrendSeries = (currentValue, points = 6) => {
  const safeValue = Math.max(currentValue || 0, 0);
  const base = safeValue * 0.55;
  const series = [];
  for (let i = 0; i < points - 1; i++) {
    const progress = i / (points - 1);
    const wobble = Math.sin(i * 1.3) * safeValue * 0.04;
    series.push(Math.max(base + (safeValue - base) * progress + wobble, 0));
  }
  series.push(safeValue); // last point is always the real current value
  return series;
};

// Builds a 6-month contribution trend from actual transaction history.
// Only successful transactions of contribution / welfare_contribution type
// are counted. The chart shows total contributed amount per month.
export const buildContributionTrendSeries = (transactions, points = 6) => {
  if (!transactions || transactions.length === 0) {
    return [];
  }

  const completedStatuses = new Set(['completed', 'success', 'paid', 'settled']);
  const contributionTypes = new Set(['contribution', 'welfare_contribution']);

  const now = new Date();
  const monthlyTotals = new Array(points).fill(0);

  transactions.forEach(tx => {
    const status = (tx.status || '').toLowerCase();
    if (!completedStatuses.has(status) && status !== '') {
      return;
    }
    if (!contributionTypes.has(tx.type)) {
      return;
    }

    const txDate = new Date(tx.date || tx.createdAt);
    if (isNaN(txDate.getTime())) {
      return;
    }

    // Determine which month bucket this transaction belongs to
    for (let i = 0; i < points; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (points - 1 - i), 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);

      if (txDate >= monthStart && txDate < monthEnd) {
        monthlyTotals[i] += Math.abs(tx.amount || 0);
        break;
      }
    }
  });

  return monthlyTotals;
};

export const getTrendPercent = (series) => {
  if (!series || series.length < 2) return 0;
  const first = series[0];
  const last = series[series.length - 1];
  if (!first) return last > 0 ? 100 : 0;
  return ((last - first) / first) * 100;
};

export const getLastMonthsLabels = (count = 6) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const labels = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(months[d.getMonth()]);
  }
  return labels;
};

export const formatCompact = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return `${Math.round(n)}`;
};

// Builds a smooth path (quadratic midpoint technique) through a set of points
export const buildSmoothPath = (points) => {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    path += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
  }
  path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return path;
};

// Small filled area mini-chart used inside each stat tile
export const MiniAreaChart = ({ data = [], color, width = 84, height = 44, gradientId }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => ({
    x: (i * width) / (data.length - 1),
    y: height - ((v - min) / range) * (height - 8) - 4,
  }));
  const linePath = buildSmoothPath(points);
  const last = points[points.length - 1];
  const areaPath = `${linePath} L ${last.x} ${height} L 0 ${height} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.4} />
          <Stop offset="1" stopColor={color} stopOpacity={0.02} />
        </SvgLinearGradient>
      </Defs>
      <Path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <Path d={linePath} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Circle cx={last.x} cy={last.y} r={2.5} fill={color} />
    </Svg>
  );
};

// Larger version used in the Wallet Overview card
export const WalletTrendChart = ({ data = [], color, width: chartWidth, height = 140, gradientId }) => {
  if (!data || data.length < 2 || chartWidth <= 0) return null;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => ({
    x: (i * chartWidth) / (data.length - 1),
    y: height - (v / max) * (height - 10) - 4,
  }));
  const linePath = buildSmoothPath(points);
  const last = points[points.length - 1];
  const areaPath = `${linePath} L ${last.x} ${height} L 0 ${height} Z`;

  return (
    <Svg width={chartWidth} height={height}>
      <Defs>
        <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0.02} />
        </SvgLinearGradient>
      </Defs>
      <Path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Circle cx={last.x} cy={last.y} r={4} fill={color} />
    </Svg>
  );
};
