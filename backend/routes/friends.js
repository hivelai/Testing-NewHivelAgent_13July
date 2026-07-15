const express = require('express');
const mongoose = require('mongoose');
const Friendship = require('../models/Friendship');
const User = require('../models/User');

const router = express.Router();

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// POST send a friend request { requesterId, recipientEmail }
router.post('/request', async (req, res) => {
  const { requesterId, recipientEmail } = req.body;

  if (!requesterId || !isValidId(requesterId)) {
    return res.status(400).json({ message: 'A valid requesterId is required' });
  }
  if (!recipientEmail || !recipientEmail.trim()) {
    return res.status(400).json({ message: 'recipientEmail is required' });
  }

  const recipient = await User.findOne({ email: recipientEmail.trim().toLowerCase() });
  if (!recipient) {
    return res.status(404).json({ message: 'No user found with that email' });
  }
  if (recipient._id.equals(requesterId)) {
    return res.status(400).json({ message: 'You cannot add yourself as a friend' });
  }

  const existing = await Friendship.findOne({
    $or: [
      { requester: requesterId, recipient: recipient._id },
      { requester: recipient._id, recipient: requesterId },
    ],
  });
  if (existing) {
    return res.status(409).json({ message: `A friend request already exists (${existing.status})` });
  }

  const friendship = await Friendship.create({ requester: requesterId, recipient: recipient._id });
  res.status(201).json(friendship);
});

// GET accepted friends for a user
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!isValidId(userId)) {
    return res.status(400).json({ message: 'Invalid userId' });
  }

  const friendships = await Friendship.find({
    status: 'accepted',
    $or: [{ requester: userId }, { recipient: userId }],
  })
    .populate('requester', 'name email')
    .populate('recipient', 'name email');

  const friends = friendships.map((f) => {
    const friend = f.requester._id.toString() === userId ? f.recipient : f.requester;
    return { friendshipId: f._id, _id: friend._id, name: friend.name, email: friend.email };
  });
  res.json(friends);
});

// GET pending incoming friend requests for a user
router.get('/:userId/pending', async (req, res) => {
  const { userId } = req.params;
  if (!isValidId(userId)) {
    return res.status(400).json({ message: 'Invalid userId' });
  }

  const pending = await Friendship.find({ recipient: userId, status: 'pending' }).populate(
    'requester',
    'name email'
  );
  res.json(pending);
});

// PUT accept a friend request
router.put('/:id/accept', async (req, res) => {
  const friendship = await Friendship.findByIdAndUpdate(
    req.params.id,
    { status: 'accepted' },
    { new: true }
  );
  if (!friendship) return res.status(404).json({ message: 'Friend request not found' });
  res.json(friendship);
});

// PUT reject a friend request
router.put('/:id/reject', async (req, res) => {
  const friendship = await Friendship.findByIdAndUpdate(
    req.params.id,
    { status: 'rejected' },
    { new: true }
  );
  if (!friendship) return res.status(404).json({ message: 'Friend request not found' });
  res.json(friendship);
});

// DELETE a friendship or cancel a pending request
router.delete('/:id', async (req, res) => {
  const friendship = await Friendship.findByIdAndDelete(req.params.id);
  if (!friendship) return res.status(404).json({ message: 'Friend request not found' });
  res.json({ message: 'Friendship removed' });
});

module.exports = router;
