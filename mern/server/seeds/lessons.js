const Lesson = require('../models/Lesson');
const data = require('./lessons.data.json');

// Only populates an empty catalog; never wipes existing lessons (attempts reference them).
async function seedLessons() {
  if ((await Lesson.countDocuments()) > 0) return 0;
  await Lesson.insertMany(data);
  return data.length;
}
module.exports = { seedLessons };
