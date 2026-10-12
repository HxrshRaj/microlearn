const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    score: { type: Number, required: true },
    xpEarned: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

attemptSchema.index({ user: 1, createdAt: -1 });
attemptSchema.index({ user: 1, lesson: 1 });

module.exports = mongoose.model('Attempt', attemptSchema);
