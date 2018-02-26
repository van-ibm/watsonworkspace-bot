# IBM Watson Workspace Bot Framework

This project is a framework for chatbot development on Watson Workspace. It is written in Javascript and [Node.js](https://nodejs.org).

Developers can contribute chatbot behavior by simply listening to and respond to specific Workspace events.

```javascript
bot.on('message-focus:ActionRequest:Schedule', (body, annotation) => {
  logger.info(`Checking calendars based on scheduling event phrase '${annotation.phrase}'`)
})
```

Chatbot setup and event listening (webhooks) are handled by the bot framework. Developers choose which events and at what level to listen. In the code above, a developer could listen for the `message-focus` or `message-focus:ActionRequest` or `message-focus:ActionRequest:Schedule` event. For more information on the available events, see the Annotations, Focus, and Action Fulfillment [documentation](https://developer.watsonwork.ibm.com/docs).

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

## Bot Paths
The Bot Framework runs on [Express](http://expressjs.com). By creating a bot, several paths will be mounted on Express to handle webhooks and OAuth.

The bot's root path is `/<appId>` where `appId` corresponds to your application's ID you received upon registration with Watson Work Services. For example, https://myapp.mybluemix.net`/1023c56a-6751-4f70-8331-ad1cfc5ee800`. The path that is used for webhooks in the *Listen to Events* page on [Watson Work Services](https://developer.watsonwork.ibm.com/apps) is https://myapp.mybluemix.net`/1023c56a-6751-4f70-8331-ad1cfc5ee800/*webhook*.

Two mounts are provided for OAuth: `/<appId>/oauth` and `/<appId>/callback`. These respectively handle triggering the OAuth flow and the resulting callback from Watson Work Services. To utilize OAuth, you must update the *Run as a User* page from your app on [Watson Work Services](https://developer.watsonwork.ibm.com/apps) page. An example *OAuth2 redirect URI* is `https://myapp.mybluemix.net/1023c56a-6751-4f70-8331-ad1cfc5ee800/callback`. To trigger the OAuth flow, redirect the user's browser to `https://myapp.mybluemix.net/1023c56a-6751-4f70-8331-ad1cfc5ee800/oauth`.

## Acting on Behalf of a User
After the OAuth flow, the bot will be presented with an access token for the user. This token will be stored in an in-memory registry for the bot.

To use the token and act on behalf of the user, a bot can utilize the `asUser` function with standard SDK functions.

```javascript
bot.asUser('<userId>').addMember(spaceId, memberId)
```

## HTTPS
To utilize SSL during local development, you can start the Bot Framework using HTTPS.

```javascript
const fs = require('fs')

botFramework.startServer({
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
})
```

The key and cert files are created using OpenSSL for example.

```
openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out cert.pem
```

On a production server such as Bluemix (IBM Cloud), you can simply use the `botFramework.startServer()` function.  HTTPS will be handled by the web layer of Bluemix.

*Note* It is possible to not start the framework with HTTPS and still use SSL-related features like OAuth. 
To do that, see a project like [watsonworkspace-starter](https://github.com/van-ibm/watsonworkspace-starter). It uses ngrok to provide a public, hosted SSL endpoint, which is required when registering your app in Watson Work Services. 
The ngrok tunnel then communicates locally to the bot framework running over standard HTTP.

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
PORT=<non-conflicting port>
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

1. Re-visit the [Listen to events](https://developer.watsonwork.ibm.com/apps/dashboard/webhooks) page.
2. Select the more icon (three vertical dots) and then `Edit`.
3. Update your Webhook URL to the productions server.
