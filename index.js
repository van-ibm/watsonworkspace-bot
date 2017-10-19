const botName = process.env.BOT_NAME || 'workspace-bot'
const EventEmitter = require('events').EventEmitter
const logger = require('winston')
const webhooks = require('./webhooks')
const ww = require('watsonworkspace-sdk')

module.exports = new EventEmitter()
module.exports.webhooks = webhooks

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
  logger.level = 'verbose'
}

// watson work configuration use Bluemix user vars or edit .env file
// these are provided when you register your appliction
var webhookSecret = process.env.WEBHOOK_SECRET
var appId = process.env.APP_ID
var appSecret = process.env.APP_SECRET

// dependencies
var express = require('express')
var http = require('http')
var crypto = require('crypto')
var bodyParser = require('body-parser')
var methodOverride = require('method-override')

// set up express
var app = express()

// all environments
app.set('port', process.env.PORT || 3000)
app.use(bodyParser.urlencoded({
  extended: false
}))
app.use(bodyParser.json({limit: '5mb'}))
app.use(methodOverride())

// watson work services middleware
app.use(verifier)
app.use(ignorer)
app.use(webhook)

module.exports.start = () => {
  http.createServer(app).listen(app.get('port'), '0.0.0.0', () => {
    logger.info(botName + ' bot listening on ' + app.get('port'))
    ww.authenticate(appId, appSecret)
    .then(token => module.exports.emit('authenticated', token))
    .catch(error => logger.error(error.message))
  })
}

/**
 * Middleware function to handle the Watson Work challenge
 */
function verifier (req, res, next) {
  if (req.body.type === 'verification') {
    logger.verbose('Received webhook verification challenge ' + req.body.challenge)

    var bodyToSend = {
      response: req.body.challenge
    }

    var hashToSend = crypto.createHmac('sha256', webhookSecret)
        .update(JSON.stringify(bodyToSend))
        .digest('hex')

    res.set('X-OUTBOUND-TOKEN', hashToSend)
    res.send(bodyToSend)
  } else {
    next()
  }
}

/**
 * Middleware function to ignore messages from this bot
 */
function ignorer (req, res, next) {
  // Ignore our own messages
  if (req.body.userId === appId) {
    res.status(201).send().end()
  } else {
    // console.log('Sending body to next middleware ' + JSON.stringify(req.body))
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
    webhooks.emitWebhook(body)
      // }
  }

  // you can acknowledge here or later
  // but you MUST respond or watson work will keep sending the message
  res.status(200).send().end()
  next()
}
