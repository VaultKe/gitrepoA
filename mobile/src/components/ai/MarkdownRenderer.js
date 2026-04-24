import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getThemeColors, typography, spacing } from '../../utils/theme';

/**
 * Mobile-optimized Markdown Renderer for AI responses
 * Converts markdown text to properly formatted React Native components
 */
const MarkdownRenderer = ({ content, style }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  // Parse markdown content into structured components
  const parseMarkdown = (text) => {
    const lines = text.split('\n');
    const elements = [];
    let currentIndex = 0;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        // Empty line - add spacing
        elements.push({
          type: 'spacing',
          key: `spacing-${index}`,
        });
        return;
      }

      // Headers (## Header)
      if (trimmedLine.startsWith('##')) {
        elements.push({
          type: 'header2',
          content: trimmedLine.replace(/^##\s*/, ''),
          key: `header2-${index}`,
        });
        return;
      }

      // Bold headers (**Header**)
      if (trimmedLine.match(/^\*\*.*\*\*$/)) {
        elements.push({
          type: 'boldHeader',
          content: trimmedLine.replace(/^\*\*(.*)\*\*$/, '$1'),
          key: `boldHeader-${index}`,
        });
        return;
      }

      // Bullet points (• Item or - Item)
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
        elements.push({
          type: 'bullet',
          content: trimmedLine.replace(/^[•-]\s*/, ''),
          key: `bullet-${index}`,
        });
        return;
      }

      // Numbered lists (1. Item)
      if (trimmedLine.match(/^\d+\.\s/)) {
        elements.push({
          type: 'numbered',
          content: trimmedLine.replace(/^\d+\.\s*/, ''),
          key: `numbered-${index}`,
        });
        return;
      }

      // Regular paragraph with inline formatting
      elements.push({
        type: 'paragraph',
        content: trimmedLine,
        key: `paragraph-${index}`,
      });
    });

    return elements;
  };

  // Render inline formatting (bold, italic, etc.)
  const renderInlineFormatting = (text) => {
    const parts = [];
    let currentText = text;
    let keyIndex = 0;

    // Process bold text (**text**)
    currentText = currentText.replace(/\*\*(.*?)\*\*/g, (match, content) => {
      const placeholder = `__BOLD_${keyIndex}__`;
      parts.push({
        type: 'bold',
        content,
        placeholder,
        key: keyIndex,
      });
      keyIndex++;
      return placeholder;
    });

    // Process italic text (*text*)
    currentText = currentText.replace(/\*(.*?)\*/g, (match, content) => {
      const placeholder = `__ITALIC_${keyIndex}__`;
      parts.push({
        type: 'italic',
        content,
        placeholder,
        key: keyIndex,
      });
      keyIndex++;
      return placeholder;
    });

    // Process emojis and special characters
    const segments = currentText.split(/(__(?:BOLD|ITALIC)_\d+__)/);
    
    return segments.map((segment, index) => {
      const part = parts.find(p => p.placeholder === segment);
      
      if (part) {
        if (part.type === 'bold') {
          return (
            <Text
              key={`inline-${part.key}`}
              style={[styles.boldText, { color: colors.text }]}
            >
              {part.content}
            </Text>
          );
        } else if (part.type === 'italic') {
          return (
            <Text
              key={`inline-${part.key}`}
              style={[styles.italicText, { color: colors.text }]}
            >
              {part.content}
            </Text>
          );
        }
      }
      
      return (
        <Text key={`text-${index}`} style={{ color: colors.text }}>
          {segment}
        </Text>
      );
    });
  };

  // Render individual elements
  const renderElement = (element) => {
    switch (element.type) {
      case 'spacing':
        return <View key={element.key} style={styles.spacing} />;

      case 'header2':
        return (
          <Text
            key={element.key}
            style={[
              styles.header2,
              { color: colors.primary, borderBottomColor: colors.border }
            ]}
          >
            {element.content}
          </Text>
        );

      case 'boldHeader':
        return (
          <Text
            key={element.key}
            style={[styles.boldHeader, { color: colors.text }]}
          >
            {element.content}
          </Text>
        );

      case 'bullet':
        return (
          <View key={element.key} style={styles.bulletContainer}>
            <Text style={[styles.bulletPoint, { color: colors.primary }]}>•</Text>
            <Text style={[styles.bulletText, { color: colors.text }]}>
              {renderInlineFormatting(element.content)}
            </Text>
          </View>
        );

      case 'numbered':
        return (
          <View key={element.key} style={styles.bulletContainer}>
            <Text style={[styles.bulletPoint, { color: colors.primary }]}>•</Text>
            <Text style={[styles.bulletText, { color: colors.text }]}>
              {renderInlineFormatting(element.content)}
            </Text>
          </View>
        );

      case 'paragraph':
        return (
          <Text
            key={element.key}
            style={[styles.paragraph, { color: colors.text }]}
          >
            {renderInlineFormatting(element.content)}
          </Text>
        );

      default:
        return null;
    }
  };

  const elements = parseMarkdown(content);

  return (
    <View style={[styles.container, style]}>
      {elements.map(renderElement)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  spacing: {
    height: spacing.sm,
  },
  header2: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginVertical: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
  },
  boldHeader: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginVertical: spacing.sm,
  },
  paragraph: {
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * 1.5,
    marginVertical: spacing.xs,
  },
  bulletContainer: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
    paddingLeft: spacing.sm,
  },
  bulletPoint: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginRight: spacing.sm,
    minWidth: 12,
  },
  bulletText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * 1.4,
  },
  boldText: {
    fontWeight: typography.fontWeight.bold,
  },
  italicText: {
    fontStyle: 'italic',
  },
});

export default MarkdownRenderer;
