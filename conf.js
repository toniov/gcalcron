'use strict';

const path = require('path');
const os = require('os');

module.exports = {
  SCOPES: ['https://www.googleapis.com/auth/calendar'],

  CRED_PATH: path.join(os.homedir(), 'client_secret.json'),

  TOKEN_PATH: path.join(os.homedir(), 'calendar_api_token.json'),

  CALENDAR_ID: 'primary',

  LIST_ORDER: 'startTime'
};
