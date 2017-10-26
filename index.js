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
const logger = require('winston')
const methodOverride = require('method-override')

// set up express
var app = express()

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

  // create the bot
  const botInstance = new Bot(appId, appSecret, webhookSecret)

  // add the bot to the registry
  botRegistry[appId] = botInstance

  return botInstance
}

module.exports.level = level => {
  logger.level = level
  SDK.level(level) // TODO make this into a per bot logger not global
}

module.exports.startServer = () => {
  app.set('port', process.env.PORT || 3000)
  http.createServer(app).listen(app.get('port'), '0.0.0.0', () => {
    logger.info(`watsonworkspace-bot framework listening on port '${app.get('port')}'`)
  })
}

function getBotId (req) {
  // the baseUrl is /81279d4c-99a9-4326-8193-7e86787cfd8c
  return req.baseUrl.substring(1)
}

function getBot (req) {
  const botAppId = getBotId(req)

  if (botRegistry[botAppId] === undefined) {
    logger.error(`Failed to retrieve bot with ID '${botAppId}'`)
  }
  return botRegistry[botAppId]
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

  // respond or watson work will keep sending the message
  res.status(200).send().end()
  next()
}
