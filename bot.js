'use strict'

const logger = require('winston')
const SDK = require('watsonworkspace-sdk')

const userRegistry = {
  // contains userId: SDK instances
}

/**
 * Adds additional behavior to the SDK specific to chatbot use cases.
 * Most importantly, this is broadcasting webhook events or acting
 * on behalf of users.
 * @extends SDK
 * @class
 */
module.exports = class Bot extends SDK {
  constructor (appId, appSecret, webhookSecret) {
    super(appId, appSecret)
    this._webhookSecret = webhookSecret
  }

  /**
   * Stores a user in the internal registry. A user corresponds to an
   * OAuth tokent obtained.
   * @param {string} userId  User ID e.g. 3c845f47-c56a-4ca9-a1cb-12dbebd72c3b
   * @param {*} token OAuth2 token
   */
  addUser (userId, token) {
    // no authentications because we already have a valid token
    userRegistry[userId] = new SDK('', '', token)
    this.emitOAuth(userId)
  }

  /**
   * Runs a command as a real user (assuming OAuth2 success).
   * @param {*} userId User ID e.g. 3c845f47-c56a-4ca9-a1cb-12dbebd72c3b
   * @returns {SDK} An SDK instance corresponding to the user to run API functions
   */
  asUser (userId) {
    return userRegistry[userId]
  }

  /**
   * Emits the oauth webhook event after a successful callback and user is added to registry.
   */
  emitOAuth (userId) {
    this.emit('oauth', userId)
  }

  /**
   * Emits the verification webhook event.
   */
  emitVerify () {
    this.emit('verify')
  }

  /**
   * Emits various webhook events. Consumers should use the bot.on() pattern.
   * Below are some example events.
   * bot.on('message-created', (message) => ...
   * bot.on('message-annotation-added', (message, annotation) => ...
   * bot.on('message-focus', (message, annotation) => ...
   * bot.on('message-focus:ActionRequest', (message, annotation) => ...
   * bot.on('message-focus:ActionRequest:Schedule', (message, annotation) => ...
   * bot.on('message-focus:Question', (message, annotation) => ...
   * bot.on('message-focus:Commitment', (message, annotation) => ...
   * bot.on('actionSelected', (message, annotation) => ...
   * bot.on('actionSelected:someActionId', (message, annotation) => ...
   * bot.on(`actionSelected:/mycommand`, (message, annotation, params) => ...
   * @param {Object} message The message sent by a Watson Work Services webhook event
   */
  emitWebhook (message) {
    const type = message.type
    const annotationType = message.annotationType
    let annotationPayload = {}

    // the annotationPayload is a string that must be parsed to an object
    if (message.annotationPayload) {
      annotationPayload = JSON.parse(message.annotationPayload)

      // since we now have the payload, remove it from the message
      // and send it as a param in the emit event
      delete message.annotationPayload
    }

    logger.verbose(`Emiting '${type}' with message`)
    logger.debug(message)
    logger.verbose(`Emiting '${type}' with payload`)
    logger.debug(annotationPayload)

    // call the node event emitters
    // message-created or message-annotation-removed
    this.emit(type, message, annotationPayload)

    // more granular annotation related events
    // 'message-focus' or 'actionSelected'
    this.emit(annotationType, message, annotationPayload)

    // 'message-focus:ActionRequest' or 'message-focus:Question'
    if (annotationPayload.lens) {
      this.emit(`${annotationType}:${annotationPayload.lens}`, message, annotationPayload)
    }

    // 'message-focus:ActionRequest:Schedule'
    if (annotationPayload.category) {
      this.emit(`${annotationType}:${annotationPayload.lens}:${annotationPayload.category}`, message, annotationPayload)
    }

    // 'actionSelected:sample_button'
    if (annotationPayload.actionId) {
      // convert the string payload to an object if present
      if (annotationPayload.payload) {
        annotationPayload.payload = JSON.parse(annotationPayload.payload)
      }

      // slash commands are the actionId; for example /todos
      if (annotationPayload.actionId.charAt(0) === '/') {
        const command = annotationPayload.actionId.split(' ')
        this.emit(`${annotationType}:${command[0]}`, message, annotationPayload, command.slice(1))
      } else {
        this.emit(`${annotationType}:${annotationPayload.actionId}`, message, annotationPayload)
      }
    }
  }

  get webhookSecret () {
    return this._webhookSecret
  }

  set webhookSecret (secret) {
    this._webhookSecret = secret
  }
}
