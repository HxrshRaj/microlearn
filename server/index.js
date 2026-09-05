const knex = require('./db/knex');
const createApp = require('./app');

const PORT = process.env.PORT || 3000;

const app = createApp(knex);

app.listen(PORT, () => {
  console.log(`MicroLearn server running on port ${PORT}`);
});
