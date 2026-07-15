const express = require('express');
const User = require('../models/User');

const router = express.Router();

// GET all users
router.get('/', async (req, res) => {
  const users = await User.find().sort({ name: 1 });
  res.json(users);
});

// POST create user
router.post('/', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Name is required' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Email is required' });
  }
  try {
    const user = await User.create({ name: name.trim(), email: email.trim() });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A user with that email already exists' });
    }
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
