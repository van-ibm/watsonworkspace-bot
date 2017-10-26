require('dotenv').config()

const ngrok = require('ngrok')
const config = {
  proto: 'http',
  addr: process.env.PORT,
  region: 'us'
}

// subdomains are a paid service of ngrok
if (process.env.SUBDOMAIN && process.env.AUTHTOKEN) {
  config.subdomain = process.env.SUBDOMAIN
  config.authtoken = process.env.AUTHTOKEN
}

ngrok.connect(config, (err, url) => {
  if (err) {
    console.log(`Error creating ngrok ${err}`)
  } else {
    console.log(`Use '${url}/${process.env.APP_ID}' as your webhook URL in Watson Workspace`)
  }
})
