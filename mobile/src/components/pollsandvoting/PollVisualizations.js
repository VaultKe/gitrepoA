import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Rect, Text as SvgText, G, Line } from 'react-native-svg';
import { spacing, typography } from '../../utils/theme';
import { getTotalVotesCast, getTotalEligibleVoters, getVotePercentage } from '../../utils/pollsVotingHelpers';

const PieChart = ({ data, size = 120, colors: chartColors }) => {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulativeAngle = 0;
  const center = size / 2;
  const radius = (size - 20) / 2;

  const defaultColors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];
  const chartColorPalette = chartColors || defaultColors;

  return (
    <Svg width={size} height={size}>
      {data.map((item, index) => {
        const percentage = item.value / total;
        const angle = percentage * 360;
        const startAngle = cumulativeAngle;
        const endAngle = cumulativeAngle + angle;

        const x1 = center + radius * Math.cos((startAngle * Math.PI) / 180);
        const y1 = center + radius * Math.sin((startAngle * Math.PI) / 180);
        const x2 = center + radius * Math.cos((endAngle * Math.PI) / 180);
        const y2 = center + radius * Math.sin((endAngle * Math.PI) / 180);

        const largeArcFlag = angle > 180 ? 1 : 0;

        cumulativeAngle = endAngle;

        return (
          <G key={index}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={chartColorPalette[index % chartColorPalette.length]}
              strokeWidth="20"
              strokeDasharray={`${(angle / 360) * 2 * Math.PI * radius} ${(1 - angle / 360) * 2 * Math.PI * radius}`}
              strokeDashoffset={-(startAngle / 360) * 2 * Math.PI * radius}
            />
          </G>
        );
      })}
      <Circle cx={center} cy={center} r={radius - 10} fill="white" />
    </Svg>
  );
};

const BarChart = ({ data, width = 200, height = 100, colors: chartColors }) => {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map(item => item.value));
  const barWidth = width / data.length - 10;
  const defaultColors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];
  const chartColorPalette = chartColors || defaultColors;

  return (
    <Svg width={width} height={height}>
      {data.map((item, index) => {
        const barHeight = (item.value / maxValue) * (height - 20);
        const x = index * (barWidth + 10) + 5;
        const y = height - barHeight - 5;

        return (
          <G key={index}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={chartColorPalette[index % chartColorPalette.length]}
              rx="2"
            />
            <SvgText
              x={x + barWidth / 2}
              y={y - 5}
              fontSize="10"
              fill="#666"
              textAnchor="middle"
            >
              {item.value}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
};

const ProgressChart = ({ completed, total, width = 200, height = 40, colors }) => {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <View style={{ width, height, justifyContent: 'center' }}>
      <View style={[styles.progressBar, { backgroundColor: colors.border, height: 8, borderRadius: 4 }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${percentage}%`,
              backgroundColor: colors.primary,
              height: 8,
              borderRadius: 4
            }
          ]}
        />
      </View>
      <Text style={[styles.progressText, { color: colors.textSecondary, fontSize: 12, marginTop: 4 }]}>
        {completed}/{total} votes ({percentage.toFixed(1)}%)
      </Text>
    </View>
  );
};

const PollVisualizations = ({ poll, colors, isDesktop, getTotalVotesCast, getTotalEligibleVoters, getVotePercentage }) => {
  if (!poll.options || poll.options.length === 0) return null;

  const totalVotes = getTotalVotesCast(poll);
  const chartData = poll.options.map((option, index) => ({
    label: option.option_text || `Option ${index + 1}`,
    value: option.vote_count || 0,
  }));

  return (
    <View style={[
      styles.visualizationsContainer,
      isDesktop && styles.visualizationsContainerDesktop
    ]}>
      <Text style={[
        styles.visualizationTitle,
        { color: colors.text },
        isDesktop && styles.visualizationTitleDesktop
      ]}>
        Poll Results Analysis
      </Text>

      <View style={[
        styles.chartsContainer,
        isDesktop && styles.chartsContainerDesktop
      ]}>
        {/* Pie Chart */}
        <View style={[styles.chartItem, isDesktop && styles.chartItemDesktop]}>
          <Text style={[
            styles.chartTitle,
            { color: colors.text },
            isDesktop && styles.chartTitleDesktop
          ]}>
            Vote Distribution
          </Text>
          <View style={styles.pieChartContainer}>
            <PieChart data={chartData} size={isDesktop ? 160 : 120} colors={colors} />
          </View>
        </View>

        {/* Bar Chart */}
        <View style={[styles.chartItem, isDesktop && styles.chartItemDesktop]}>
          <Text style={[
            styles.chartTitle,
            { color: colors.text },
            isDesktop && styles.chartTitleDesktop
          ]}>
            Vote Counts
          </Text>
          <BarChart
            data={chartData}
            width={isDesktop ? 300 : 200}
            height={isDesktop ? 120 : 100}
            colors={colors}
          />
        </View>

        {/* Progress Chart */}
        <View style={[styles.chartItem, isDesktop && styles.chartItemDesktop]}>
          <Text style={[
            styles.chartTitle,
            { color: colors.text },
            isDesktop && styles.chartTitleDesktop
          ]}>
            Participation
          </Text>
          <ProgressChart
            completed={totalVotes}
            total={getTotalEligibleVoters(poll)}
            width={isDesktop ? 300 : 200}
            height={isDesktop ? 50 : 40}
            colors={colors}
          />
        </View>
      </View>

      {/* Legend */}
      <View style={[
        styles.legendContainer,
        isDesktop && styles.legendContainerDesktop
      ]}>
        {chartData.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'][index % 6] }]} />
            <Text style={[
              styles.legendText,
              { color: colors.textSecondary },
              isDesktop && styles.legendTextDesktop
            ]}>
              {item.label}: {item.value} votes ({totalVotes > 0 ? Math.round((item.value / totalVotes) * 100) : 0}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  visualizationsContainer: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  visualizationsContainerDesktop: {
    marginTop: 16,
    marginBottom: 20,
    padding: 24,
    borderRadius: 12,
  },
  visualizationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  visualizationTitleDesktop: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  chartsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  chartsContainerDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  chartItem: {
    alignItems: 'center',
    marginBottom: 12,
    minWidth: 120,
  },
  chartItemDesktop: {
    marginBottom: 24,
    minWidth: 280,
    flex: 1,
    marginHorizontal: 8,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  chartTitleDesktop: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  pieChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  legendContainerDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
  },
  legendTextDesktop: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    textAlign: 'center',
  },
});

export default PollVisualizations;
