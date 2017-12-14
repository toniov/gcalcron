#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { CronJob } = require('cron');
const prettyCron = require('prettycron');
const { spawn } = require('child_process');
const google = require('googleapis');
const argv = require('minimist')(process.argv.slice(2));
const conf = require('./conf');
const help = require('./help');

/**
 * Get absolute path
 * @param {string} rawPath
 */
const getPath = (rawPath) => {
  if (path.isAbsolute(rawPath)) {
    return rawPath;
  } else {
    return path.join(process.cwd(), rawPath);
  }
};

/**
 * Error handler
 * @param {Object} err
 */
const errHandler = (err) => {
  console.error(`[ERROR] ${err.code} ${err.stack}`);
};

/**
 * Get Oauth2 Client
 */
const getOauth2Client = () => {
  const content = fs.readFileSync(conf.CRED_PATH);
  const {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: redirectUris
  } = JSON.parse(content).installed;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUris[0]);
};

/**
 * Get Calendar Client
 * @returns {Promise}
 */
const getClient = async () => {
  const oauth2Client = getOauth2Client();
  const tokens = fs.readFileSync(conf.TOKEN_PATH);
  oauth2Client.setCredentials(JSON.parse(tokens));
  return google.calendar({ version: 'v3', auth: oauth2Client });
};

/**
 * Generate consent page URL
 * @returns {Promise}
 */
const generateUrl = async () => {
  const oauth2Client = getOauth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: conf.SCOPES
  });
  console.log(authUrl);
};

/**
 * Store token
 * @param {string} code
 * @returns {Promise}
 */
const storeToken = async (code) => {
  const oauth2Client = getOauth2Client();
  const tokens = await promisify(oauth2Client.getToken).bind(oauth2Client)(code);
  fs.writeFileSync(conf.TOKEN_PATH, JSON.stringify(tokens));
  console.log(`Token stored in ${conf.TOKEN_PATH}`);
};

/**
 * Start listening for events
 * @param {string} cronTime
 * @param {string} outFile
 * @param {string} errFile
 * @returns {Promise}
 */
const start = async (cronTime, outFile, errFile) => {
  const readableCron = prettyCron.toString(cronTime, true);
  console.log(`[INFO] Process started checking your calendar: ${readableCron}`);
  const defParams = {
    calendarId: conf.CALENDAR_ID,
    singleEvents: true,
    orderBy: conf.LIST_ORDER
  };
  const calendar = await getClient();
  let lastExecuted = new Date();
  let checkingEvents = [];

  const executeCommand = async () => {
    try {
      const listParams = Object.assign({
        timeMin: lastExecuted.toISOString(),
        timeMax: new Date().toISOString()
      }, defParams);

      const { items: events } = await promisify(calendar.events.list)(listParams);

      for (let { summary, description, id } of events) {
        if (summary.substring(0,8) !== 'Execute:' || checkingEvents.includes(id)) {
          continue;
        }
        checkingEvents.push(id);
        const newSummary = `[Executed] ${summary.slice(9)}`;
        const updateParams = {
          calendarId: conf.CALENDAR_ID,
          eventId: id,
          resource: {
            summary: newSummary
          }
        };
        await promisify(calendar.events.patch)(updateParams);

        const command = description || summary.substring(9);
        let out = process.stdout;
        let err = process.stderr;
        if (outFile) {
          out = fs.openSync(getPath(outFile), 'a');
        } else if (conf.OUT_PATH) {
          out = fs.openSync(getPath(conf.OUT_PATH), 'a');
        }
        if (errFile) {
          err = fs.openSync(getPath(errFile), 'a');
        } else if (conf.ERR_PATH) {
          err = fs.openSync(getPath(conf.ERR_PATH), 'a');
        }
        const cp = spawn(command, {
          shell: conf.SHELL || true,
          stdio: ['ignore', out, err]
        });
        console.log(`[INFO] Executed: '${command}'`);
        cp.once('close', code => {
          if (code > 0) {
            console.log(`[ERROR] '${command}' Exited with code ${code}`);
          }
        });
        checkingEvents.splice(checkingEvents.indexOf(2), 1);
      }
      lastExecuted = new Date();
    } catch (err) {
      errHandler(err);
    }
  };

  new CronJob({
    cronTime: cronTime,
    onTick: executeCommand,
    start: true
  });
};

// main
(async function () {
  const command = argv._[0];
  const configPath = argv.config || argv.C;
  if (configPath) {
    const configFile = require(getPath(configPath));
    Object.assign(conf, configFile);
  }
  switch (command) {
    case 'start': {
      const cronTime = argv._[1];
      const outFile = argv.out || argv.o;
      const errFile = argv.err || argv.e;
      await start(cronTime, outFile, errFile);
      break;
    }
    case 'generateUrl': {
      await generateUrl();
      break;
    }
    case 'storeToken': {
      const code = argv._[0];
      await storeToken(code);
      break;
    }
    case 'help': {
      console.log(help);
      break;
    }
    default: {
      console.log(help);
      break;
    }
  }
})().catch(errHandler);
