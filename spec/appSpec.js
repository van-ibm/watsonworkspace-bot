describe('workspace-bot', () => {
  // set a much longer timeout to allow interaction with Workspace UI
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 300000

  // space/conversation ID for testing; ensure you've added the app to a space
  const spaceId = process.env.SPEC_SPACE_ID

  const botFramework = require('../index')
  botFramework.level(process.env.SPEC_LOGGER_LEVEL)

  // a bot where the expectation is that runtime vars define a single bot
  const defaultBot = botFramework.create()

  // a bot where the user or program explictly creates a bot
  const bot = botFramework.create(
    process.env.APP_ID,
    process.env.APP_SECRET,
    process.env.WEBHOOK_SECRET
  )

  it('precheck', () => {
    expect(defaultBot).not.toBe(null)
    expect(bot).not.toBe(null)
  })

  it('default-authenticate', done => {
    defaultBot.authenticate()
    .then(token => done())
    .catch(error => console.log(error))
  })

  it('specified-authenticate', done => {
    bot.authenticate()
    .then(token => done())
    .catch(error => console.log(error))
  })

  it('startServer', done => {
    // this spec expects the developer to enable the webhook to proceed
    console.log(`Re-enable the webhook at 'https://developer.watsonwork.ibm.com/apps/dashboard/webhooks'`)

    bot.on('verify', () => {
      console.log(`Webhook verified`)
      done()
    })

    botFramework.startServer()
  })

  it('webhook-message-created', done => {
    bot.sendMessage(spaceId, 'Type any message into Workspace')

    // receives the message the user types
    bot.on('message-created', message => {
      expect(message).not.toBe(null)

      bot.sendMessage(spaceId, `Received '${message.content}'`)
      .finally(messge => done())
    })
  })
})
