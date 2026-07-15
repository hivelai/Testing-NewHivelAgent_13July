const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

jest.mock('../models/Friendship');
jest.mock('../models/User');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const friendRoutes = require('../routes/friends');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/friends', friendRoutes);
  return app;
}

const USER_A = new mongoose.Types.ObjectId().toString();
const USER_B = new mongoose.Types.ObjectId().toString();

describe('POST /api/friends/request', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates a pending friend request', async () => {
    User.findOne.mockResolvedValue({ _id: new mongoose.Types.ObjectId(USER_B), equals: (id) => id.toString() === USER_B });
    Friendship.findOne.mockResolvedValue(null);
    Friendship.create.mockResolvedValue({ requester: USER_A, recipient: USER_B, status: 'pending' });

    const res = await request(buildApp())
      .post('/api/friends/request')
      .send({ requesterId: USER_A, recipientEmail: 'b@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
  });

  it('rejects a request with an invalid requesterId', async () => {
    const res = await request(buildApp())
      .post('/api/friends/request')
      .send({ requesterId: 'not-an-id', recipientEmail: 'b@example.com' });

    expect(res.status).toBe(400);
  });

  it('returns 404 when the recipient email does not match a user', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(buildApp())
      .post('/api/friends/request')
      .send({ requesterId: USER_A, recipientEmail: 'missing@example.com' });

    expect(res.status).toBe(404);
  });

  it('returns 409 when a friendship already exists between the pair', async () => {
    User.findOne.mockResolvedValue({ _id: new mongoose.Types.ObjectId(USER_B), equals: (id) => id.toString() === USER_B });
    Friendship.findOne.mockResolvedValue({ status: 'pending' });

    const res = await request(buildApp())
      .post('/api/friends/request')
      .send({ requesterId: USER_A, recipientEmail: 'b@example.com' });

    expect(res.status).toBe(409);
  });
});

describe('GET /api/friends/:userId', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns friends with a friendshipId for removal', async () => {
    const populateMock = jest.fn().mockReturnThis();
    const friendship = {
      _id: 'friendship-1',
      requester: { _id: new mongoose.Types.ObjectId(USER_A), name: 'Alice', email: 'alice@example.com' },
      recipient: { _id: new mongoose.Types.ObjectId(USER_B), name: 'Bob', email: 'bob@example.com' },
    };
    Friendship.find.mockReturnValue({ populate: populateMock, then: undefined });
    populateMock.mockReturnValueOnce({ populate: jest.fn().mockResolvedValue([friendship]) });

    const res = await request(buildApp()).get(`/api/friends/${USER_A}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { friendshipId: 'friendship-1', _id: USER_B, name: 'Bob', email: 'bob@example.com' },
    ]);
  });

  it('returns 400 for an invalid userId', async () => {
    const res = await request(buildApp()).get('/api/friends/not-an-id');
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/friends/:id/accept', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('marks a friend request as accepted', async () => {
    Friendship.findByIdAndUpdate.mockResolvedValue({ status: 'accepted' });

    const res = await request(buildApp()).put('/api/friends/abc123/accept');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');
  });

  it('returns 404 when the friend request does not exist', async () => {
    Friendship.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(buildApp()).put('/api/friends/abc123/accept');

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/friends/:id', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('removes a friendship', async () => {
    Friendship.findByIdAndDelete.mockResolvedValue({ _id: 'abc123' });

    const res = await request(buildApp()).delete('/api/friends/abc123');

    expect(res.status).toBe(200);
  });
});
