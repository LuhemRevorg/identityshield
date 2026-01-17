import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Enrollment APIs
export const startEnrollment = async (userId = null, email = null) => {
  const response = await api.post('/enrollment/start', {
    user_id: userId,
    email: email,
  });
  return response.data;
};

export const uploadChunk = async (sessionId, videoChunk) => {
  const response = await api.post('/enrollment/chunk', {
    session_id: sessionId,
    video_chunk: videoChunk,
  });
  return response.data;
};

export const completeEnrollment = async (sessionId) => {
  const response = await api.post('/enrollment/complete', {
    session_id: sessionId,
  });
  return response.data;
};

// Profile APIs
export const getProfile = async (userId) => {
  const response = await api.get(`/profile/${userId}`);
  return response.data;
};

// Conversation APIs
export const sendMessage = async (sessionId, message, elapsedTime) => {
  const response = await api.post('/conversation/message', {
    session_id: sessionId,
    message: message,
    elapsed_time: elapsedTime,
  });
  return response.data;
};

// Verification APIs
export const verifyContent = async (userId, file) => {
  const formData = new FormData();
  formData.append('user_id', userId);
  formData.append('file', file);

  const response = await api.post('/verify', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getVerificationHistory = async (userId, limit = 10) => {
  const response = await api.get(`/verify/history/${userId}?limit=${limit}`);
  return response.data;
};

// Health check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;
