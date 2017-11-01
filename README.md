# IBM Watson Workspace Bot Framework

This project is a framework for chatbot development on Watson Workspace. It is written in Javascript and [Node.js](https://nodejs.org).

Developers can contribute chatbot behavior by simply listening to and respond to specific Workspace events.

```javascript
bot.on('message-focus:ActionRequest:Schedule', (body, annotation) => {
  logger.info(`Checking calendars based on scheduling event phrase '${annotation.phrase}'`)
})
```

Chatbot setup and event listening (webhooks) are handled by the bot framework. Developers choose which events and at what level to listen. In the code above, a developer could listen for the `message-focus` or `message-focus:ActionRequest` or `message-focus:ActionRequest:Schedule` event. For more information on the available events, see the Annotations, Focus, and Action Fulfillment [documentation](https://workspace.ibm.com/developer/docs).

The following are a few combinations.
```javascript
bot.on('message-created', (message) => ...
bot.on('message-annotation-added', (message, annotation) => ...
bot.on('message-focus', (message, annotation) => ...
bot.on('message-focus:ActionRequest', (message, annotation) => ...
bot.on('message-focus:ActionRequest:Schedule', (message, annotation) => ...
bot.on('message-focus:Question', (message, annotation) => ...
bot.on('message-focus:Commitment', (message, annotation) => ...
bot.on('actionSelected', (message, annotation) => ...
bot.on('actionSelected:someActionId', (message, annotation) => ...
```

Slash commands are also handled by the event emitter. The params argument is an array of parameters sent to the slash command by the user.
```javascript
bot.on(`actionSelected:/mycommand`, (message, annotation, params) => ...
```


To build your bot, create a separate project. Then add the necessary require statements and begin listening to events to add your own behavior.

```javascript
// creates a bot server with a single bot
const botFramework = require('watsonworkspace-bot')
botFramework.level('debug')
botFramework.startServer()

const bot = botFramework.create() // bot settings defined by process.env
bot.authenticate()

bot.on('message-annotation-added', (message, annotation) => {
  // do something awesome using watsonworkspace-sdk
})
```

## Local Development
### nodemon

[Nodemon](https://github.com/remy/nodemon) is used for development. As you make changes to Javascript code, nodemon will automatically reload the bot with the latest changes. The ngrok tunnel is loaded separately. You do not need to restart the tunnel. Simply make changes to your source code and allow nodemon to reload the chatbot automatically.

### dotenv
[.Env](https://www.npmjs.com/package/dotenv) is used to store environment variables used by the bot: application IDs, secrets, etc. When doing local development, create a .env file in your project's folder with the following:

```
NODE_ENV=development
APP_ID=<your appId>
APP_SECRET=<your appSecret>
WEBHOOK_SECRET=<your webhookSecret>
BOT_NAME=<your botName>
```

Later when using Bluemix or similar PaaS solutions, you can edit the runtime variables to create the same property-value pairs.

### ngrok

Watson Workspace uses webhooks as an event-driven means to exchange information with your chatbot. This requires your chatbot to be listening on a public server. Rather than writing code and deploying to a public server during development, this starter uses [ngrok](https://ngrok.com/) automatically.

Simply execute the `npm run-script dev` command. This will programmatically create a connection to a public domain using ngrok. A message will appear that indicates the URL you should use in your webhook.

```
Use 'https://cdf9d82f.ngrok.io/a7cfbdac-cdab-3d6f-ae13-0654b6b8e880' as your webhook URL in Watson Workspace
```

### winston

[Winston](https://github.com/winstonjs/winston) is the preferred logger.

## Production Deployment

When moving your chatbot into production, you will need to edit your Webhook URL.

1. Re-visit the [Listen to events](https://workspace.ibm.com/developer/apps/dashboard/webhooks) page.
2. Select the more icon (three vertical dots) and then `Edit`.
3. Update your Webhook URL to the productions server.
