// install express with `npm install express`
import express from 'express'
import { resolve } from 'path'

import syncEmotesForChannel from './emotes'
import logger from './logger'

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(express.static(resolve(__dirname, '../client')))

const api = express.Router()

api.get('/sync/:guild', (req, res) => {
  let { channel, only, exclude } = req.query
  let { guild } = req.params

  if (typeof channel !== 'string') return res.status(400).send('channel param is required')
  if (typeof only === 'object') return res.status(400).send('only param must be a string or array of strings')
  if (typeof exclude === 'object') return res.status(400).send('exclude param must be a string or array of strings')

  res.status(200).send('Syncing emotes...')
  syncEmotesForChannel(channel as string, {
    guild,
    only: Array.isArray(only) ? only : [only],
    exclude: Array.isArray(exclude) ? exclude : [exclude],
  }).then(() => logger.debug(`Synced emotes for channel ${channel}`))
})

app.use('/api', api)

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`)
})

// export 'app'
export default app
