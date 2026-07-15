import { useEffect, useState } from 'react';
import {
  getUsers,
  createUser,
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
} from './api';
import './Friends.css';

function Friends() {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [friendEmail, setFriendEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadUsers = async () => {
    const res = await getUsers();
    setUsers(res.data);
    if (!currentUserId && res.data.length > 0) {
      setCurrentUserId(res.data[0]._id);
    }
  };

  const loadFriendData = async (userId) => {
    if (!userId) {
      setFriends([]);
      setPending([]);
      return;
    }
    const [friendsRes, pendingRes] = await Promise.all([
      getFriends(userId),
      getPendingRequests(userId),
    ]);
    setFriends(friendsRes.data);
    setPending(pendingRes.data);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadFriendData(currentUserId);
  }, [currentUserId]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    try {
      const res = await createUser(newUserName.trim(), newUserEmail.trim());
      setUsers([...users, res.data]);
      setCurrentUserId(res.data._id);
      setNewUserName('');
      setNewUserEmail('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleAddFriend = async (e) => {
    e.preventDefault();
    if (!friendEmail.trim() || !currentUserId) return;
    try {
      await sendFriendRequest(currentUserId, friendEmail.trim());
      setFriendEmail('');
      setMessage('Friend request sent');
      setError('');
      loadFriendData(currentUserId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send friend request');
      setMessage('');
    }
  };

  const handleAccept = async (id) => {
    await acceptFriendRequest(id);
    loadFriendData(currentUserId);
  };

  const handleReject = async (id) => {
    await rejectFriendRequest(id);
    loadFriendData(currentUserId);
  };

  const handleRemoveFriend = async (id) => {
    await removeFriend(id);
    loadFriendData(currentUserId);
  };

  return (
    <div className="friends">
      <h2>Friends</h2>

      <div className="friends-user-switch">
        <label htmlFor="current-user">Logged in as</label>
        <select
          id="current-user"
          value={currentUserId}
          onChange={(e) => setCurrentUserId(e.target.value)}
        >
          {users.length === 0 && <option value="">No users yet</option>}
          {users.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleCreateUser} className="friends-form">
        <input
          type="text"
          placeholder="Your name"
          value={newUserName}
          onChange={(e) => setNewUserName(e.target.value)}
        />
        <input
          type="email"
          placeholder="Your email"
          value={newUserEmail}
          onChange={(e) => setNewUserEmail(e.target.value)}
        />
        <button type="submit">Create user</button>
      </form>

      {currentUserId && (
        <form onSubmit={handleAddFriend} className="friends-form">
          <input
            type="email"
            placeholder="Friend's email"
            value={friendEmail}
            onChange={(e) => setFriendEmail(e.target.value)}
          />
          <button type="submit">Add friend</button>
        </form>
      )}

      {message && <p className="friends-message">{message}</p>}
      {error && <p className="error">{error}</p>}

      {pending.length > 0 && (
        <div className="friends-section">
          <h3>Pending requests</h3>
          <ul className="friends-list">
            {pending.map((req) => (
              <li key={req._id}>
                <span>
                  {req.requester.name} ({req.requester.email})
                </span>
                <div className="friends-actions">
                  <button onClick={() => handleAccept(req._id)}>Accept</button>
                  <button onClick={() => handleReject(req._id)}>Reject</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="friends-section">
        <h3>Your friends</h3>
        {friends.length === 0 ? (
          <p>No friends yet. Add one above!</p>
        ) : (
          <ul className="friends-list">
            {friends.map((friend) => (
              <li key={friend.friendshipId}>
                <span>
                  {friend.name} ({friend.email})
                </span>
                <div className="friends-actions">
                  <button onClick={() => handleRemoveFriend(friend.friendshipId)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Friends;
