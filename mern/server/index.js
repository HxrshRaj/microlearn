const mongoose = require('mongoose');
const config = require('./config');
const createApp = require('./app');
const { seedLessons } = require('./seeds/lessons');

async function main() {
  await mongoose.connect(config.mongoUri);
  await seedLessons(); // idempotent: only fills an empty catalog
  createApp().listen(config.port, () => console.log(`MicroLearn MERN API on :${config.port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
