import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth APIs
export const register = async (email, password, name = null) => {
  const response = await api.post('/auth/register', {
    email,
    password,
    name,
  });
  return response.data;
};

export const login = async (email, password) => {
  const response = await api.post('/auth/login', {
    email,
    password,
  });
  return response.data;
};

export const logout = async (sessionToken) => {
  const formData = new FormData();
  formData.append('session_token', sessionToken);
  const response = await api.post('/auth/logout', formData);
  return response.data;
};

export const getCurrentUser = async (sessionToken) => {
  const response = await api.get(`/auth/me?session_token=${sessionToken}`);
  return response.data;
};

// Enrollment APIs
export const startEnrollment = async (topic = 'General Chat', userId = null, email = null) => {
  const response = await api.post('/enrollment/start', {
    user_id: userId,
    email: email,
    topic: topic,
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

export const getEnrollmentSessions = async (userId) => {
  const response = await api.get(`/sessions/${userId}`);
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

// Transcription API (uses Groq Whisper)
export const transcribeAudio = async (audioBase64) => {
  const response = await api.post('/transcribe', {
    audio_base64: audioBase64,
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
