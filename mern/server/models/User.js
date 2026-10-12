const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema(
  {
    totalXp: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActivityDate: { type: String, default: null }, // YYYY-MM-DD
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, minlength: 3, maxlength: 30 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    // SHA-256 of the currently valid refresh token (rotation: one live token per user).
    refreshTokenHash: { type: String, default: null },
    stats: { type: statsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

userSchema.index({ 'stats.totalXp': -1, username: 1 });

module.exports = mongoose.model('User', userSchema);
