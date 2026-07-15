import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_URL });

export const getTasks = () => api.get('/tasks');
export const createTask = (title, priority) => api.post('/tasks', { title, priority });
export const updateTask = (id, data) => api.put(`/tasks/${id}`, data);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);

export const getUsers = () => api.get('/users');
export const createUser = (name, email) => api.post('/users', { name, email });

export const getFriends = (userId) => api.get(`/friends/${userId}`);
export const getPendingRequests = (userId) => api.get(`/friends/${userId}/pending`);
export const sendFriendRequest = (requesterId, recipientEmail) =>
  api.post('/friends/request', { requesterId, recipientEmail });
export const acceptFriendRequest = (id) => api.put(`/friends/${id}/accept`);
export const rejectFriendRequest = (id) => api.put(`/friends/${id}/reject`);
export const removeFriend = (id) => api.delete(`/friends/${id}`);
