'use strict'

const logger = require('winston')
const SDK = require('watsonworkspace-sdk')

module.exports = class Bot extends SDK {
  constructor (appId, appSecret, webhookSecret) {
    super(appId, appSecret)
    this._webhookSecret = webhookSecret
  }

  emitVerify () {
    this.emit('verify')
  }

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
      this.emit(`${annotationType}:${annotationPayload.actionId}`, message, annotationPayload)
    }
  }

  get webhookSecret () {
    return this._webhookSecret
  }

  set webhookSecret (secret) {
    this._webhookSecret = secret
  }
}
