import { createLogger, format, transports } from 'winston'

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [new transports.Console({ format: format.simple() })],
})

export = logger
