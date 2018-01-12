'use strict'

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
const hostname = process.env.hostname || 'localhost'
const port = process.env.port || 3000

// app.use('/config/:appId', configurer)

module.exports = (express) => {
  app = express
}

module.exports.create = (appId, appSecret, webhookSecret) => {
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

  // watson work services specifc middleware
  app.use(path, verifier)
  app.use(path, ignorer)
  app.use(path, webhook)
  app.use(`${path}/oauth`, oauth)
  app.use(`${path}/callback`, oauthCallback)
  app.use(path, end)  // should always be last

  // create the bot
  const botInstance = new Bot(appId, appSecret, webhookSecret)

  // add the bot to the registry
  botRegistry[appId] = botInstance

  // create the oauth client for the bot
  botInstance.oauth = oauthClient(botInstance)

  return botInstance
}

module.exports.level = level => {
  logger.level = level
  SDK.level(level) // TODO make this into a per bot logger not global
}

module.exports.startServer = (options) => {
  const ssl = options && options.key && options.cert
  const server = ssl ? https.createServer(options, app) : http.createServer(app)

  server.listen(port, hostname, () => {
    logger.info(`watsonworkspace-bot framework listening on port ${port} using ssl ${ssl !== undefined}`)
  })
}

function getBotId (req) {
  // the baseUrl is /81279d4c-99a9-4326-8193-7e86787cfd8c/oauth
  // get just the appId
  return req.baseUrl.substring(1, 37)
}

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

var marks = []

function mark (messageId) {
  logger.verbose(`marking ${messageId} [${marks.length}]`)
  marks.push(messageId)
}

/**
 * Checks if a message ID has been read/sent previously from this application
 */
function marked (messageId) {
  var p = false
  for (var i in marks) {
    if (marks[i] === messageId) {
      p = true
      break
    }
  }

  if (marks.length > 200) {
    marks = [] // housekeeping clear the array
  }

  // console.log(`${messageId} mark=${p}`)

  return p
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

  next()
}
