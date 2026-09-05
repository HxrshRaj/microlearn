// Shared Knex instance used by the whole app at runtime.
require('dotenv').config();
const knexLib = require('knex');
const config = require('../../knexfile');

const environment = process.env.NODE_ENV || 'development';

const knex = knexLib(config[environment] || config.development);

module.exports = knex;
