const express = require('express');
const Task = require('../models/Task');

const router = express.Router();

// GET all tasks
router.get('/', async (req, res) => {
  const tasks = await Task.find().sort({ createdAt: -1 });
  res.json(tasks);
});

// POST create task
router.post('/', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Title is required' });
  }
  const task = await Task.create({ title: title.trim() });
  res.status(201).json(task);
});

// PUT update task
router.put('/:id', async (req, res) => {
  const { title, completed } = req.body;
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { ...(title !== undefined && { title }), ...(completed !== undefined && { completed }) },
    { new: true, runValidators: true }
  );
  if (!task) return res.status(404).json({ message: 'Task not found' });
  res.json(task);
});

// DELETE task
router.delete('/:id', async (req, res) => {
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found' });
  res.json({ message: 'Task deleted' });
});

module.exports = router;
