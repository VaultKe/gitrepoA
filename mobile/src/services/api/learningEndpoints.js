import { makeRequest, makeRequestWithRetry } from './client';

const getLearningCategories = async () => {
  return await makeRequest('/learning/categories');
};

const getLearningCourses = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = queryString ? `/learning/courses?${queryString}` : '/learning/courses';
  return await makeRequest(url);
};

const getLearningCourse = async (courseId) => {
  return await makeRequest(`/learning/courses/${courseId}`);
};

const getLearningCategory = async (categoryId) => {
  return await makeRequest(`/learning/categories/${categoryId}`);
};

const startCourse = async (courseId) => {
  return await makeRequest(`/learning/courses/${courseId}/start`, {
    method: 'POST',
  });
};

const createLearningCategory = async (categoryData) => {
  return await makeRequest('/learning/admin/categories', {
    method: 'POST',
    body: JSON.stringify(categoryData),
  });
};

const updateLearningCategory = async (categoryId, categoryData) => {
  return await makeRequest(`/learning/admin/categories/${categoryId}`, {
    method: 'PUT',
    body: JSON.stringify(categoryData),
  });
};

const deleteLearningCategory = async (categoryId) => {
  return await makeRequest(`/learning/admin/categories/${categoryId}`, {
    method: 'DELETE',
  });
};

const createLearningCourse = async (courseData) => {
  return await makeRequest('/learning/admin/courses', {
    method: 'POST',
    body: JSON.stringify(courseData),
  });
};

const updateLearningCourse = async (courseId, courseData) => {
  return await makeRequest(`/learning/admin/courses/${courseId}`, {
    method: 'PUT',
    body: JSON.stringify(courseData),
  });
};

const deleteLearningCourse = async (courseId) => {
  return await makeRequest(`/learning/admin/courses/${courseId}`, {
    method: 'DELETE',
  });
};

const submitQuizResults = async (courseId, results) => {
  return await makeRequest(`/learning/courses/${courseId}/submit-quiz`, {
    method: 'POST',
    body: JSON.stringify(results),
  });
};

const uploadLearningImage = async (imageData) => {
  const formData = new FormData();
  if (imageData.file) {
    formData.append('image', imageData.file, imageData.file.name);
  } else if (imageData.uri) {
    const filename = imageData.uri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    formData.append('image', {
      uri: imageData.uri,
      name: filename,
      type: type,
    });
  } else {
    throw new Error('No valid image data provided');
  }
  return await makeRequest('/learning/upload/image', {
    method: 'POST',
    body: formData,
  });
};

const uploadLearningVideo = async (videoData) => {
  const formData = new FormData();
  if (videoData.uri) {
    const filename = videoData.uri.split('/').pop() || 'video.mp4';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `video/${match[1]}` : 'video/mp4';
    formData.append('video', {
      uri: videoData.uri,
      name: filename,
      type: type,
    });
  } else if (videoData.file) {
    formData.append('video', videoData.file);
  }
  return await makeRequest('/learning/upload/video', {
    method: 'POST',
    body: formData,
  });
};

const uploadLearningDocument = async (documentData) => {
  const formData = new FormData();
  if (documentData.uri) {
    const filename = documentData.uri.split('/').pop() || 'document.pdf';
    const type = documentData.mimeType || 'application/pdf';
    formData.append('document', {
      uri: documentData.uri,
      name: filename,
      type: type,
    });
  } else if (documentData.file) {
    formData.append('document', documentData.file);
  }
  return await makeRequest('/learning/upload/document', {
    method: 'POST',
    body: formData,
  });
};

const getLearningAnalytics = async () => {
  try {
    let response = await makeRequest('/learning/admin/analytics');
    if (!response.success && response.status === 404) {
      response = await buildLearningAnalytics();
    }
    return response;
  } catch (error) {
    return { success: false, error: error.message, data: null };
  }
};

const buildLearningAnalytics = async () => {
  try {
    const [categoriesResponse, coursesResponse] = await Promise.all([
      getLearningCategories(),
      getLearningCourses({ limit: 1000 })
    ]);

    const analytics = calculateLearningAnalytics(
      categoriesResponse.data || [],
      coursesResponse.data || []
    );

    return {
      success: true,
      data: analytics,
      source: 'calculated'
    };
  } catch (error) {
    return { success: false, error: error.message, data: null };
  }
};

const calculateLearningAnalytics = (categories, courses) => {
  const categoryMetrics = {
    total: categories.length,
    active: categories.filter(c => c.is_active !== false).length,
    inactive: categories.filter(c => c.is_active === false).length
  };

  const courseMetrics = {
    total: courses.length,
    published: courses.filter(c => c.status === 'published').length,
    draft: courses.filter(c => c.status === 'draft').length,
    archived: courses.filter(c => c.status === 'archived').length
  };

  const coursesByCategory = categories.map(category => ({
    categoryId: category.id,
    categoryName: category.name,
    courseCount: courses.filter(c => c.category_id === category.id).length
  }));

  return {
    generatedAt: new Date().toISOString(),
    categories: categoryMetrics,
    courses: courseMetrics,
    distribution: coursesByCategory,
    summary: {
      totalCategories: categoryMetrics.total,
      totalCourses: courseMetrics.total,
      publishedCourses: courseMetrics.published,
      activeCategories: categoryMetrics.active,
      completionRate: courseMetrics.total > 0 ? (courseMetrics.published / courseMetrics.total * 100).toFixed(1) : 0
    }
  };
};

export {
  getLearningCategories,
  getLearningCourses,
  getLearningCourse,
  getLearningCategory,
  startCourse,
  createLearningCategory,
  updateLearningCategory,
  deleteLearningCategory,
  createLearningCourse,
  updateLearningCourse,
  deleteLearningCourse,
  submitQuizResults,
  uploadLearningImage,
  uploadLearningVideo,
  uploadLearningDocument,
  getLearningAnalytics,
  buildLearningAnalytics,
  calculateLearningAnalytics,
};