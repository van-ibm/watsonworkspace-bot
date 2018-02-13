'use strict'

/**
 * Watson Work Services Bot Framework
 * @module watsonworkspace-bot
 */
require('dotenv').config()

const Bot = require('./bot')
const botRegistry = {
  // bots added via create()
}
const SDK = require('watsonworkspace-sdk')

const bodyParser = require('body-parser')
const crypto = require('crypto')
const express = require('express')
const http = require('http')
const https = require('https')
const logger = require('winston')
const methodOverride = require('method-override')
const nonce = require('nonce')()
const oauth2 = require('simple-oauth2')

// set up express
var app = express()

// IBM Cloud uses hostname and port; do not change case or Express won't bind properly
const hostname = process.env.HOSTNAME || process.env.hostname || '0.0.0.0'
const port = process.env.PORT || process.env.port || 3000

// app.use('/config/:appId', configurer)

/**
 * Creates an Express server to host bots.
 * @param {Application} [express] Express server if already available (e.g. Node-RED) 
 */
module.exports = (express) => {
  app = express
}

/**
 * Exports the Express server.
 */
module.exports.express = app

/**
 * Creates and mounts a bot to the Express server.
 * 
 * The bot's root path is /<appId> where appId corresponds to your application's ID.
 * For example, https://myapp.mybluemix.net`/1023c56a-6751-4f70-8331-ad1cfc5ee800`. 
 * Webhooks in the Listen to Events page on Watson Work Services should point to use the /webhook route.
 * For example, https://myapp.mybluemix.net`/1023c56a-6751-4f70-8331-ad1cfc5ee800/webhook`.
 * Two mounts are provided for OAuth: /<appId>/oauth and /<appId>/callback. 
 * These respectively handle triggering the OAuth flow and the resulting callback from Watson Work Services. 
 * To utilize OAuth, you must update the Run as a User page from your app on Watson Work Services page. 
 * An example OAuth2 redirect URI is https://myapp.mybluemix.net/1023c56a-6751-4f70-8331-ad1cfc5ee800/callback. 
 * To trigger the OAuth flow, redirect the user's browser to 
 * https://myapp.mybluemix.net/1023c56a-6751-4f70-8331-ad1cfc5ee800/oauth.
 * 
 * @param {string} appId The bot's app ID from Watson Work Services
 * @param {string} appSecret The bot's app secret from Watson Work Services
 * @param {string} webhookSecret The bot's webhook secret from Watson Work Services
 * @param {string[]} routes Custom routes e.g. 'completed'
 * @param {function[]} middleware Associated middleware to custom routes; follows (req, res) Express middleware
 * @returns {Bot} The bot instance
 */
module.exports.create = (appId, appSecret, webhookSecret, routes, middleware) => {
  // if undefined, assume the bot's info is in the runtime properties
  if (appId === undefined) {
    appId = process.env.APP_ID
    appSecret = process.env.APP_SECRET
    webhookSecret = process.env.WEBHOOK_SECRET
  }

  // the path will be the bot's appId; used to later emit events to bot
  const path = `/${appId}`

  logger.info(`Creating bot '${appId}' on path '${path}'`)

  // standard middleware needed to handle JSON resonses from work services
  app.use(path, bodyParser.urlencoded({
    extended: false
  }))
  app.use(path, bodyParser.json({limit: '5mb'}))
  app.use(path, methodOverride())

  // watson work services specific middleware
  const defaultHook = '/webhook'
  logger.info(`Mounting ${defaultHook} middleware`)
  app.use(`${path}${defaultHook}`, verifier)
  app.use(`${path}${defaultHook}`, ignorer)
  app.use(`${path}${defaultHook}`, webhook)

  logger.info(`Mounting /oauth and /callback middleware`)
  app.use(`${path}/oauth`, oauth)
  app.use(`${path}/callback`, oauthCallback)

  // custom middleware added by bot developers
  if(routes && middleware) {
    if(routes.length !== middleware.length) {
      logger.warn(`Number of routes do not match middleware! Skipping custom middleware.`)
    } else {
      routes.forEach((route, i) => {
        logger.info(`Mounting /${route} middleware`)
        app.use(`${path}/${route}`, middleware[i])
      })
    }
  }  
  // create the bot
  const botInstance = new Bot(appId, appSecret, webhookSecret)

  // add the bot to the registry
  botRegistry[appId] = botInstance

  // create the oauth client for the bot
  botInstance.oauth = oauthClient(botInstance)

  return botInstance
}

/**
 * Sets the logging level for the bot framework.
 * @param {string} level Level for debug e.g. error, info, warn, verbose, debug
 */
module.exports.level = level => {
  logger.level = level
  SDK.level(level) // TODO make this into a per bot logger not global
}

/**
 * Starts the Express server. By default, the server will listen on HTTP.
 * 
 * The hostname and port are inferred from process.env.
 * process.env.HOSTNAME | process.env.hostname
 * process.env.PORT | process.env.port
 * 
 * To use SSL for local testing of OAuth, use the options object.
 * { key: fs.readFileSync('key.pem'), cert: fs.readFileSync('cert.pem') }
 * 
 * @param {Object} [options] SSL options if applicable
 * @returns {Server} The node HTTP server
 */
module.exports.startServer = (options) => {
  const ssl = options && options.key && options.cert
  const server = ssl ? https.createServer(options, app) : http.createServer(app)

  return server.listen(port, hostname, () => {
    logger.info(`watsonworkspace-bot framework listening on port ${port} using ssl ${ssl !== undefined}`)
  })
}

/**
 * Gets a bot's ID from a request (inferred from the URL).
 * @param {Request} req The HTTP request
 * @returns {string} The bot's ID
 */
function getBotId (req) {
  // the baseUrl is /81279d4c-99a9-4326-8193-7e86787cfd8c/oauth
  // get just the appId
  return req.baseUrl.substring(1, 37)
}

/**
 * Gets a Bot instance from a request (inferred from the URL).
 * @param {Request} req The HTTP request
 * @returns {Bot} The Bot instance
 */
function getBot (req) {
  const botAppId = getBotId(req)

  if (botRegistry[botAppId] === undefined) {
    logger.error(`Failed to retrieve bot with ID '${botAppId}'`)
  }
  return botRegistry[botAppId]
}

/**
 * Middleware function to handle Configuration URL parameters
 */
function configurer (req, res) {
  const appId = req.params.appId
  const bot = botRegistry[appId]

  if (appId && bot) {
    const token = req.query.configurationToken

    logger.verbose(`Received configuration for appId ${appId} with configurationToken ${token}`)

    bot.getConfigurationData(token)
    .then(body => {
      logger.verbose(body)
      res.send(`Valid configurationToken`)
    })
    .catch(body => {
      res.send(`Invalid configurationToken`)
      logger.error(body)
    })
    // req.spaceId
    // req.userId
  } else {
    res.send(`Invalid appId ${appId}`)
  }
}

/**
 * Ends the middleware chain. You must respond 200 or Watson Work Services will keep
 * retrying to send messages.
 */
function end (req, res) {
  // respond or watson work will keep sending the message
  res.status(200).send().end()
}

/**
 * Middleware function to handle OAuth invocation
 */
function oauth (req, res) {
  const bot = getBot(req)

  const authorizationUri = bot.oauth.authorizationCode.authorizeURL({
    redirect_uri: `https://${hostname}:${port}/${bot.appId}/callback`,
    state: nonce()
  })

  logger.verbose(`Redirecting to ${authorizationUri}`)

  res.redirect(authorizationUri)
}

/**
 * Middleware function to handle OAuth callback
 */
function oauthCallback (req, res) {
  const bot = getBot(req)

  const tokenConfig = {
    code: req.query.code,
    redirect_uri: `https://${hostname}:${port}/${bot.appId}/callback`
  }

  bot.oauth.authorizationCode.getToken(tokenConfig,
    (error, result) => {
      if (error) {
        logger.error(`Error with OAuth callback ${error.message}`)
        res.send(error.message).end()
      } else {
        const accessToken = bot.oauth.accessToken.create(result)

        logger.verbose(`Adding ${accessToken.token.displayName} to ${bot.appId} user registry`)
        bot.addUser(accessToken.token.id, accessToken.token.access_token)

        // TODO Need to handle refresh of tokens

        res.send(`
          <p>${accessToken.token.displayName}</p>
          <p>${accessToken.token.id}</p>
          <p>Valid until ${accessToken.token.expires_at}</p>
          <p>${accessToken.token.access_token}</p>
          <p>${accessToken.token.scope}</p>
        `).end()
      }
    })
}

/**
 * Creates the OAuth client to retrieve a user's token
 */
function oauthClient (bot) {
  return oauth2.create({
    client: {
      id: bot.appId,
      secret: bot.appSecret
    },
    auth: {
      tokenHost: 'https://api.watsonwork.ibm.com'
    }
  })
}

/**
 * Middleware function to handle the Watson Work challenge
 */
function verifier (req, res, next) {
  if (req.body.type === 'verification') {
    logger.verbose('Received webhook verification challenge ' + req.body.challenge)

    const bot = getBot(req)

    const bodyToSend = {
      response: req.body.challenge
    }

    const hashToSend = crypto.createHmac('sha256', bot.webhookSecret)
        .update(JSON.stringify(bodyToSend))
        .digest('hex')

    res.set('X-OUTBOUND-TOKEN', hashToSend)
    res.send(bodyToSend)

    bot.emitVerify()
  } else {
    next()
  }
}

/**
 * Middleware function to ignore messages from this bot
 */
function ignorer (req, res, next) {
  const botAppId = getBotId(req)

  // Ignore the bot's own messages
  if (req.body.userId === botAppId) {
    res.status(201).send().end()
  } else {
    next()
  }
}

/**
 * Middleware function to handle the webhook event
 */
function webhook (req, res, next) {
  const body = req.body

  if (body.type) {
    logger.verbose(`Webhook event '${body.type}' for messageId ${body.messageId} with body`)
    logger.debug(body)

    // only handle messages that this bot has not seen before
    // if (!marked(body.messageId)) {

    // look up the bot in the registry
    const bot = getBot(req)
    bot.emitWebhook(body)
      // }
  }

  end(req, res)
}
