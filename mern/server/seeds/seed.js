const mongoose = require('mongoose');
const config = require('../config');
const { seedLessons } = require('./lessons');

mongoose
  .connect(config.mongoUri)
  .then(seedLessons)
  .then((n) => console.log(`Seeded ${n} lessons`))
  .finally(() => mongoose.disconnect());
