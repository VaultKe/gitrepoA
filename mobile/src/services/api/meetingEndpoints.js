import { makeRequest, makeRequestWithRetry } from './client';

const getMeetings = async (chamaId, limit = 20, offset = 0) => {
  try {
    return await makeRequest(`/meetings/?chamaId=${chamaId}&limit=${limit}&offset=${offset}`);
  } catch (error) {
    throw error;
  }
};

const getUserMeetings = async (limit = 50, offset = 0) => {
  try {
    const response = await makeRequest(`/meetings/user?limit=${limit}&offset=${offset}`);
    if (response.success && response.data && Array.isArray(response.data)) {
      return response;
    }
    throw new Error('No data in user meetings response');
  } catch (error) {
    try {
      const { getUserChamas } = await import('./chamaEndpoints');
      const chamasResponse = await getUserChamas();
      if (!chamasResponse.success || !chamasResponse.data) {
        return {
          success: true,
          data: [],
          message: 'No chamas found for user',
          meta: { total: 0, limit, offset }
        };
      }

      const allMeetings = [];
      const chamas = chamasResponse.data;

      for (const chama of chamas) {
        try {
          const meetingsResponse = await getMeetings(chama.id);
          if (meetingsResponse.success && meetingsResponse.data) {
            const meetingsWithChama = meetingsResponse.data.map(meeting => ({
              ...meeting,
              chamaName: chama.name,
              chamaId: chama.id
            }));
            allMeetings.push(...meetingsWithChama);
          }
        } catch (chamaError) {
        }
      }

      allMeetings.sort((a, b) => {
        const dateA = new Date(a.scheduledAt || a.date);
        const dateB = new Date(b.scheduledAt || b.date);
        return dateB - dateA;
      });

      const paginatedMeetings = allMeetings.slice(offset, offset + limit);

      return {
        success: true,
        data: paginatedMeetings,
        message: `Found ${allMeetings.length} meetings from ${chamas.length} chamas`,
        meta: {
          total: allMeetings.length,
          limit,
          offset,
          chamasCount: chamas.length
        }
      };
    } catch (fallbackError) {
    }

    return {
      success: true,
      data: [],
      message: 'No meetings found',
      meta: { total: 0, limit, offset }
    };
  }
};

const createMeeting = async (meetingData) => {
  return await makeRequest('/meetings/', {
    method: 'POST',
    body: meetingData,
  });
};

const joinJitsiMeeting = async (meetingId, userRole = 'member') => {
  return await makeRequest(`/meetings/${meetingId}/join-jitsi`, {
    method: 'POST',
    body: { userRole },
  });
};

const startMeeting = async (meetingId) => {
  return await makeRequest(`/meetings/${meetingId}/start`, {
    method: 'POST',
  });
};

const endMeeting = async (meetingId) => {
  return await makeRequest(`/meetings/${meetingId}/end`, {
    method: 'POST',
  });
};

const getMeetingCalendarAddUrl = async (meetingId) => {
  return await makeRequest(`/meetings/${meetingId}/calendar/add-url`, {
    method: 'GET',
  });
};

const createMeetingCalendarEvent = async (meetingId) => {
  return await makeRequest(`/meetings/${meetingId}/calendar/create`, {
    method: 'POST',
  });
};

const getMerryGoRoundCalendarEventURL = async (merryGoRoundId) => {
  return await makeRequest(`/merry-go-rounds/${merryGoRoundId}/calendar/add-url`, {
    method: 'GET',
  });
};

const markMeetingAttendance = async (meetingId, attendanceData) => {
  return await makeRequest(`/meetings/${meetingId}/attendance`, {
    method: 'POST',
    body: attendanceData,
  });
};

const getMeetingAttendance = async (meetingId) => {
  try {
    return await makeRequest(`/meetings/${meetingId}/attendance`);
  } catch (error) {
    return {
      success: false,
      error: 'Meeting attendance not available - backend connection required'
    };
  }
};

const getMeetingDetails = async (meetingId) => {
  try {
    return await makeRequest(`/meetings/${meetingId}`);
  } catch (error) {
    return {
      success: true,
      data: {
        id: meetingId,
        title: 'Meeting Details Not Available',
        description: 'Backend connection unavailable. Meeting details will be loaded when connection is restored.',
        scheduledAt: new Date().toISOString(),
        duration: 60,
        location: 'Location not available',
        meetingType: 'physical',
        status: 'completed',
        attendeeCount: 0,
        conductedAt: new Date().toISOString()
      }
    };
  }
};

const getMeetingMinutes = async (meetingId) => {
  try {
    return await makeRequest(`/meetings/${meetingId}/minutes`);
  } catch (error) {
    return {
      success: false,
      error: 'Meeting minutes not available - backend connection required'
    };
  }
};

const getMeetingDocuments = async (meetingId) => {
  try {
    return await makeRequest(`/meetings/${meetingId}/documents`);
  } catch (error) {
    return {
      success: false,
      error: 'Meeting documents not available - backend connection required'
    };
  }
};

const createMeetingMinutes = async (meetingId, minutesData) => {
  return await makeRequest(`/meetings/${meetingId}/minutes`, {
    method: 'POST',
    body: minutesData,
  });
};

const updateMeetingMinutes = async (meetingId, minutesData) => {
  return await makeRequest(`/meetings/${meetingId}/minutes`, {
    method: 'PUT',
    body: minutesData,
  });
};

const addMeetingDocument = async (meetingId, documentData) => {
  return await makeRequest(`/meetings/${meetingId}/documents`, {
    method: 'POST',
    body: documentData,
  });
};

const updateMeeting = async (meetingId, meetingData) => {
  return await makeRequest(`/meetings/${meetingId}`, {
    method: 'PUT',
    body: meetingData,
  });
};

const joinMeeting = async (meetingId) => {
  return await makeRequest(`/meetings/${meetingId}/join`, {
    method: 'POST',
  });
};

export {
  getMeetings,
  getUserMeetings,
  createMeeting,
  joinJitsiMeeting,
  startMeeting,
  endMeeting,
  getMeetingCalendarAddUrl,
  createMeetingCalendarEvent,
  getMerryGoRoundCalendarEventURL,
  markMeetingAttendance,
  getMeetingAttendance,
  getMeetingDetails,
  getMeetingMinutes,
  getMeetingDocuments,
  createMeetingMinutes,
  updateMeetingMinutes,
  addMeetingDocument,
  updateMeeting,
  joinMeeting,
};