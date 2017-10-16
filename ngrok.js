require('dotenv').config()

const ngrok = require('ngrok')

ngrok.connect({
  proto: 'http',
  addr: process.env.PORT,
  region: 'us'
}, (err, url) => {
  if (err) {
    console.log(`Error creating ngrok ${err}`)
  } else {
    console.log(`Use '${url}' as your webhook URL in Watson Workspace`)
  }
})
