import axios from 'axios';

const FRIEND_SERVICE_URL = import.meta.env.VITE_FRIEND_SERVICE_URL || 'http://localhost:4000/friend';

export const callFriend = (payload = {}) => axios.post(FRIEND_SERVICE_URL, payload);
