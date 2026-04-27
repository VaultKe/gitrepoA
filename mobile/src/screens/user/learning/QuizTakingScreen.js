import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import ApiService from '../../../services/api';

const QuizTakingScreen = ({ navigation, route }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { course } = route.params;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [quizResults, setQuizResults] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [loading, setLoading] = useState(false);

  // Parse quiz questions from multiple sources
  const parseQuizQuestions = () => {
    // First try to get from quiz_questions field
    if (course.quiz_questions && course.quiz_questions.length > 0) {
      return course.quiz_questions;
    }

    // Then try to parse from main content field
    if (course.content) {
      try {
        const parsedContent = JSON.parse(course.content);
        if (parsedContent.type === 'quiz' && parsedContent.questions) {
          return parsedContent.questions;
        }
      } catch (error) {
        console.error('Failed to parse quiz content:', error);
      }
    }

    return [];
  };

  const questions = parseQuizQuestions();
  const currentQuestion = questions[currentQuestionIndex];

  // Debug logging
  useEffect(() => {
    console.log('🧪 Quiz Debug Info:');
    console.log('📚 Course:', course.title);
    console.log('❓ Questions found:', questions.length);
    console.log('📝 Questions data:', JSON.stringify(questions, null, 2));
    if (course.content) {
      console.log('📄 Raw content:', course.content);
    }
  }, [questions, course]);

  useEffect(() => {
    // Set timer if quiz has time limit
    if (course.duration_minutes && course.duration_minutes > 0) {
      setTimeRemaining(course.duration_minutes * 60); // Convert to seconds
    }
  }, []);

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0) {
      handleSubmitQuiz();
    }
  }, [timeRemaining]);

  const handleAnswerSelect = (questionIndex, answerIndex) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: answerIndex,
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const calculateResults = () => {
    let correctAnswers = 0;
    const detailedResults = [];

    questions.forEach((question, index) => {
      const userAnswer = selectedAnswers[index];

      // Handle both correct_answer (snake_case) and correctAnswer (camelCase) for backward compatibility
      const correctAnswerIndex = question.correct_answer !== undefined
        ? question.correct_answer
        : question.correctAnswer;

      // Validate correct_answer index
      if (correctAnswerIndex === undefined || correctAnswerIndex < 0 || correctAnswerIndex >= question.options.length) {
        console.error(`❌ Invalid correct_answer index ${correctAnswerIndex} for question ${index + 1}`);
        console.error(`📝 Question:`, question);
        console.error(`🔍 Available fields:`, Object.keys(question));
      }

      const isCorrect = userAnswer === correctAnswerIndex;

      if (isCorrect) {
        correctAnswers++;
      }

      // Safe access to options with fallback
      const userAnswerText = userAnswer !== undefined && userAnswer < question.options.length
        ? question.options[userAnswer]
        : 'Not answered';

      const correctAnswerText = correctAnswerIndex < question.options.length
        ? question.options[correctAnswerIndex]
        : 'Invalid correct answer';

      detailedResults.push({
        question: question.question,
        userAnswer: userAnswerText,
        correctAnswer: correctAnswerText,
        isCorrect,
        explanation: question.explanation || 'No explanation provided',
        questionIndex: index + 1,
        userAnswerIndex: userAnswer,
        correctAnswerIndex: correctAnswerIndex,
      });

      // Debug logging for each question
      console.log(`🔍 Question ${index + 1}:`, {
        question: question.question,
        userAnswer: userAnswer,
        correctAnswer: correctAnswerIndex,
        isCorrect,
        options: question.options
      });
    });

    const percentage = Math.round((correctAnswers / questions.length) * 100);
    
    return {
      correctAnswers,
      totalQuestions: questions.length,
      percentage,
      detailedResults,
      passed: percentage >= 70, // 70% passing grade
    };
  };

  const handleSubmitQuiz = async () => {
    try {
      setLoading(true);
      const results = calculateResults();
      setQuizResults(results);
      setShowResults(true);

      // Send results to backend for progress tracking
      try {
        await ApiService.submitQuizResults(course.id, {
          score: results.percentage,
          correct_answers: results.correctAnswers,
          total_questions: results.totalQuestions,
          passed: results.passed,
          time_taken: course.duration_minutes ? (course.duration_minutes * 60 - (timeRemaining || 0)) : null,
          detailed_results: results.detailedResults
        });
        console.log('✅ Quiz results submitted successfully');
      } catch (error) {
        console.error('❌ Failed to submit quiz results:', error);
        // Don't block the user if submission fails
      }
      
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      Alert.alert('Error', 'Failed to submit quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderQuizHeader = () => (
    <Card style={styles.headerCard}>
      <View style={styles.headerContent}>
        <View style={styles.progressInfo}>
          <Text style={[styles.questionCounter, { color: colors.text }]}>
            Question {currentQuestionIndex + 1} of {questions.length}
          </Text>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                },
              ]}
            />
          </View>
        </View>
        
        {timeRemaining !== null && (
          <View style={styles.timerContainer}>
            <Ionicons name="time" size={16} color={colors.warning} />
            <Text style={[styles.timerText, { color: colors.warning }]}>
              {formatTime(timeRemaining)}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );

  const renderQuestion = () => (
    <Card style={styles.questionCard}>
      <Text style={[styles.questionText, { color: colors.text }]}>
        {currentQuestion.question}
      </Text>
      
      <View style={styles.optionsContainer}>
        {currentQuestion.options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.optionButton,
              {
                backgroundColor: selectedAnswers[currentQuestionIndex] === index 
                  ? colors.primary + '20' 
                  : colors.surface,
                borderColor: selectedAnswers[currentQuestionIndex] === index 
                  ? colors.primary 
                  : colors.border,
              },
            ]}
            onPress={() => handleAnswerSelect(currentQuestionIndex, index)}
          >
            <View style={styles.optionContent}>
              <View style={[
                styles.radioButton,
                {
                  borderColor: selectedAnswers[currentQuestionIndex] === index
                    ? colors.primary
                    : colors.border,
                }
              ]}>
                {selectedAnswers[currentQuestionIndex] === index && (
                  <View style={[styles.radioButtonInner, { backgroundColor: colors.primary }]} />
                )}
              </View>
              <Text style={[
                styles.optionText,
                {
                  color: selectedAnswers[currentQuestionIndex] === index 
                    ? colors.primary 
                    : colors.text,
                }
              ]}>
                {option}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );

  const renderNavigationButtons = () => (
    <View style={styles.navigationContainer}>
      <TouchableOpacity
        style={[
          styles.navButton,
          styles.previousButton,
          {
            backgroundColor: currentQuestionIndex > 0 ? colors.surface : colors.disabled,
            borderColor: colors.border,
          },
        ]}
        onPress={handlePreviousQuestion}
        disabled={currentQuestionIndex === 0}
      >
        <Ionicons 
          name="chevron-back" 
          size={20} 
          color={currentQuestionIndex > 0 ? colors.text : colors.textTertiary} 
        />
        <Text style={[
          styles.navButtonText,
          { color: currentQuestionIndex > 0 ? colors.text : colors.textTertiary }
        ]}>
          Previous
        </Text>
      </TouchableOpacity>

      {currentQuestionIndex < questions.length - 1 ? (
        <TouchableOpacity
          style={[styles.navButton, styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNextQuestion}
        >
          <Text style={[styles.navButtonText, { color: colors.white }]}>
            Next
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.white} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.navButton, styles.submitButton, { backgroundColor: colors.success }]}
          onPress={handleSubmitQuiz}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Text style={[styles.navButtonText, { color: colors.white }]}>
                Submit Quiz
              </Text>
              <Ionicons name="checkmark" size={20} color={colors.white} />
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  const handleRetakeQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowResults(false);
    setQuizResults(null);
    if (course.duration_minutes && course.duration_minutes > 0) {
      setTimeRemaining(course.duration_minutes * 60);
    }
  };

  const handleFinishQuiz = () => {
    navigation.goBack();
  };

  if (showResults) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Overall Results Card */}
          <Card style={styles.resultsCard}>
            <View style={styles.resultsHeader}>
              <Ionicons
                name={quizResults.passed ? "checkmark-circle" : "close-circle"}
                size={48}
                color={quizResults.passed ? colors.success : colors.error}
              />
              <Text style={[styles.resultsTitle, { color: colors.text }]}>
                Quiz Complete!
              </Text>
            </View>

            <View style={styles.scoreContainer}>
              <Text style={[styles.scoreText, { color: quizResults.passed ? colors.success : colors.error }]}>
                {quizResults.correctAnswers}/{quizResults.totalQuestions}
              </Text>
              <Text style={[styles.percentageText, { color: quizResults.passed ? colors.success : colors.error }]}>
                {quizResults.percentage}%
              </Text>
            </View>

            <Text style={[styles.statusText, { color: quizResults.passed ? colors.success : colors.error }]}>
              {quizResults.passed ? '🎉 Congratulations! You Passed!' : '😔 You need 70% to pass. Try again!'}
            </Text>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.success }]}>
                  {quizResults.correctAnswers}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Correct
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.error }]}>
                  {quizResults.totalQuestions - quizResults.correctAnswers}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Incorrect
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.primary }]}>
                  {quizResults.totalQuestions}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Total
                </Text>
              </View>
            </View>
          </Card>

          {/* Detailed Results */}
          <Card style={styles.detailsCard}>
            <Text style={[styles.detailsTitle, { color: colors.text }]}>
              Question Review
            </Text>

            {quizResults.detailedResults.map((result, index) => (
              <View key={index} style={[styles.questionResult, { borderColor: colors.border }]}>
                <View style={styles.questionHeader}>
                  <Text style={[styles.questionNumber, { color: colors.textSecondary }]}>
                    Question {index + 1}
                  </Text>
                  <View style={[
                    styles.resultIndicator,
                    { backgroundColor: result.isCorrect ? colors.success : colors.error }
                  ]}>
                    <Ionicons
                      name={result.isCorrect ? "checkmark" : "close"}
                      size={16}
                      color={colors.white}
                    />
                  </View>
                </View>

                <Text style={[styles.questionText, { color: colors.text }]}>
                  {result.question}
                </Text>

                <View style={styles.answersContainer}>
                  <View style={styles.answerRow}>
                    <Text style={[styles.answerLabel, { color: colors.textSecondary }]}>
                      Your answer:
                    </Text>
                    <Text style={[
                      styles.answerText,
                      { color: result.isCorrect ? colors.success : colors.error }
                    ]}>
                      {result.userAnswer}
                    </Text>
                  </View>

                  {!result.isCorrect && (
                    <View style={styles.answerRow}>
                      <Text style={[styles.answerLabel, { color: colors.textSecondary }]}>
                        Correct answer:
                      </Text>
                      <Text style={[styles.answerText, { color: colors.success }]}>
                        {result.correctAnswer}
                      </Text>
                    </View>
                  )}
                </View>

                {result.explanation && (
                  <View style={[styles.explanationContainer, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.explanationLabel, { color: colors.primary }]}>
                      Explanation:
                    </Text>
                    <Text style={[styles.explanationText, { color: colors.text }]}>
                      {result.explanation}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </Card>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.retakeButton, { backgroundColor: colors.warning }]}
              onPress={handleRetakeQuiz}
            >
              <Ionicons name="refresh" size={20} color={colors.white} />
              <Text style={[styles.actionButtonText, { color: colors.white }]}>
                Retake Quiz
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.finishButton, { backgroundColor: colors.primary }]}
              onPress={handleFinishQuiz}
            >
              <Ionicons name="checkmark-done" size={20} color={colors.white} />
              <Text style={[styles.actionButtonText, { color: colors.white }]}>
                Finish
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="help-circle-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Quiz Available
          </Text>
          <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
            This course doesn't have any quiz questions yet.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderQuizHeader()}
        {renderQuestion()}
        {renderNavigationButtons()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  headerCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressInfo: {
    flex: 1,
    marginRight: spacing.lg,
  },
  questionCounter: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timerText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  questionCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  questionText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  optionsContainer: {
    gap: spacing.md,
  },
  optionButton: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  optionText: {
    fontSize: typography.fontSize.base,
    flex: 1,
    lineHeight: 20,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
    minWidth: 120,
  },
  previousButton: {
    justifyContent: 'flex-start',
  },
  nextButton: {
    justifyContent: 'flex-end',
  },
  submitButton: {
    justifyContent: 'center',
  },
  navButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  resultsCard: {
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  resultsHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  resultsTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.md,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  scoreText: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  percentageText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  statusText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  detailsCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  detailsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.lg,
  },
  questionResult: {
    borderBottomWidth: 1,
    paddingBottom: spacing.lg,
    marginBottom: spacing.lg,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  questionNumber: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  resultIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answersContainer: {
    marginBottom: spacing.md,
  },
  answerRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  answerLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginRight: spacing.sm,
    minWidth: 100,
  },
  answerText: {
    fontSize: typography.fontSize.sm,
    flex: 1,
    fontWeight: typography.fontWeight.medium,
  },
  explanationContainer: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  explanationLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  explanationText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  retakeButton: {
    // Specific styles for retake button
  },
  finishButton: {
    // Specific styles for finish button
  },
  actionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  emptyDescription: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default QuizTakingScreen;
