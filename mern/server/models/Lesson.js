const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  options: { type: [String], required: true },
  correctIndex: { type: Number, required: true },
});

const lessonSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  category: { type: String, required: true, index: true },
  summary: { type: String, required: true },
  xpReward: { type: Number, required: true },
  sortOrder: { type: Number, default: 0 },
  questions: [questionSchema],
});

module.exports = mongoose.model('Lesson', lessonSchema);
