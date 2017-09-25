const chalk = require('chalk');

module.exports =
`${chalk.bold('Usage:')}
  gcalcron [-C <file>] [cmd]

      OPTIONS
          -C, --config <file>

${chalk.bold('Commands')}:

  ${chalk.bold('start')} <cron-time> [-o <file> -e <file>]
      Start to check periodically Google Calendar for processes to be executed.
      <cron-time> is a cron pattern with six fields.

        OPTIONS
          -o, --output <file>
          -e, --error <file>


  ${chalk.bold('generateUrl')}
      Generate consent page URL. In order to work client_secret.js must be in your
      home folder.


  ${chalk.bold('storeToken')} <code>
      Store Token in your home folder.


  ${chalk.bold('help')}
      Show this help page.
`;
