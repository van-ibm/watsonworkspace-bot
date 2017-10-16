'use strict'

const EventEmitter = require('events').EventEmitter
const logger = require('winston')

module.exports = new EventEmitter()

module.exports.emitWebhook = (message) => {
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
  module.exports.emit(type, message, annotationPayload)

  // more granular annotation related events
  // 'message-focus' or 'actionSelected'
  module.exports.emit(annotationType, message, annotationPayload)

  // 'message-focus:ActionRequest' or 'message-focus:Question'
  if (annotationPayload.lens) {
    module.exports.emit(`${annotationType}:${annotationPayload.lens}`, message, annotationPayload)
  }

  // 'message-focus:ActionRequest:Schedule'
  if (annotationPayload.category) {
    module.exports.emit(`${annotationType}:${annotationPayload.lens}:${annotationPayload.category}`, message, annotationPayload)
  }

  // 'actionSelected:sample_button'
  if (annotationPayload.actionId) {
    module.exports.emit(`${annotationType}:${annotationPayload.actionId}`, message, annotationPayload)
  }
}
