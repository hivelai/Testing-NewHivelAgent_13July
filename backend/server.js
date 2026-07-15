require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const taskRoutes = require('./routes/tasks');
const statsRoutes = require('./routes/stats');
const commitMetricsRoutes = require('./routes/commitMetrics');
const userRoutes = require('./routes/users');
const friendRoutes = require('./routes/friends');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mern_basic_app';

app.use(cors());
app.use(express.json());

app.use('/api/tasks', taskRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/commit-metrics', commitMetricsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
