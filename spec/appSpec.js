describe('workspace-bot', function () {
  // set a much longer timeout to allow interaction with Workspace UI
  // or long running webhook events
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 300000

  const spaceId = '57cf270ee4b06c8b753629e6'

  const bot = require('../index')
  const webhooks = bot.webhooks
  const ww = require('watsonworkspace-sdk')


  // open the localtunnel to allow webhook tests
  require('../localtunnel')

  it('start', function (done) {
    // listen for the token event to signal the app is ready to use
    bot.on('authenticated', (token) => {
      done()
    })

    // start the app to begin setting up the server and webhooks
    bot.start()
  })

  it('webhook-message-created', function (done) {
    ww.sendMessage(spaceId, 'Type any message into Workspace')

    webhooks.on('message-created', message => {
      expect(message).not.toBe(null)
      done()
    })
  })
})
