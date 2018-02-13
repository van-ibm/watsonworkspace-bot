const fs = require('fs')

describe('workspace-bot', () => {
  // set a much longer timeout to allow interaction with Workspace UI
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 300000

  require('dotenv').config()

  // space/conversation ID for testing; ensure you've added the app to a space
  const spaceId = process.env.SPEC_SPACE_ID

  const botFramework = require('../index')
  botFramework.level(process.env.SPEC_LOGGER_LEVEL)

  // a bot where the expectation is that runtime vars define a single bot
  const defaultBot = botFramework.create()

  // a bot where the user or program explictly creates a bot
  const customMiddleware = [
    ['helloworld'], [function(req, res) { res.send('Hello World!')}]
  ]

  const bot = botFramework.create(
    process.env.APP_ID,
    process.env.APP_SECRET,
    process.env.WEBHOOK_SECRET,
    customMiddleware[0],
    customMiddleware[1]
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
    // start the framework with HTTP only
    // const server = botFramework.startServer()

    // start the framework with HTTPS
    const server = botFramework.startServer({
      key: fs.readFileSync(`${__dirname}/key.pem`),
      cert: fs.readFileSync(`${__dirname}/cert.pem`)
    })

    server.on('listening', () => {
      done()
    })
  })
})
