import { REST } from '@discordjs/rest'
import { Routes, RESTGetAPIGuildEmojisResult, RESTPostAPIGuildEmojiJSONBody, RESTDeleteAPIGuildEmojiResult } from 'discord-api-types/v10'
import fs from 'fs'
import axios from 'axios'

import { AnimatedGif } from './img'
import sharp from 'sharp'
import logger from './logger'

const rest = new REST({
  version: 'v10',
}).setToken(process.env.TOKEN)

const api = {
  async getChannelEmotes(channelName: string, providers: ('7tv' | 'twitch' | 'bttv' | 'ffz')[] = ['7tv', 'twitch']): Promise<EmoteProv.ChannelEmoteRes> {
    const res = await axios.get<EmoteProv.ChannelEmoteRes>(`https://emotes.adamcy.pl/v1/channel/${channelName}/emotes/${providers.join('.')}`)
    return res.data
  },
  async getChannelId(channelName: string): Promise<EmoteProv.ChannelIdRes> {
    const res = await axios.get<EmoteProv.ChannelIdRes>(`https://emotes.adamcy.pl/v1/channel/${channelName}/id`)
    return res.data
  },
}

async function uploadEmote(
  name: string,
  {
    data: buff,
    info,
  }: {
    data: Buffer
    info: sharp.OutputInfo
  }
) {
  if (!guild) throw new Error('GUILD_ID is not set')
  var mime = `image/${info.format}`
  var dataUri = `data:${mime};base64,${buff.toString('base64')}`
  const body: RESTPostAPIGuildEmojiJSONBody = { image: dataUri, name }
  let uploaded = true

  const res = await rest
    .post(cmd, {
      body,
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .catch((e) => {
      if (e.message.includes('size')) {
        logger.error(`Emote ${name} was ${prettyBytes(info.size)}. Too large!`)
      }
      logger.error(e.message)
      uploaded = false
    })
  logger.info(res)
  logger.info(`Uploaded ${name} to ${guild}`)
}

async function removeEmotes(emotesToRemove: RESTGetAPIGuildEmojisResult) {
  for (const emote of emotesToRemove) {
    const emoteId = emote.id
    if (!emoteId) continue
    const emojiCmd = Routes.guildEmoji(guild, emoteId)
    await rest.delete(emojiCmd)
    logger.info(`Removed ${emote.name}:${emote.id}`)
  }
}

let guild: string
let exclude: string[]
let cmd: `/guilds/${string}/emojis`
let prettyBytes: typeof import('pretty-bytes').default

export = async function syncEmotesForChannel(channelName: string, options: { only?: string[]; guild?: string; exclude?: string[] }) {
  prettyBytes = (await import('pretty-bytes')).default

  guild = options.guild || process.env.GUILD_ID || ''
  if (guild.length === 0) throw new Error('GUILD_ID is not set')
  exclude = options.exclude || []
  cmd = Routes.guildEmojis(guild)
  const currentEmotes = (await rest.get(cmd)) as RESTGetAPIGuildEmojisResult
  // const channelId = await api.getChannelId(channelName);
  const emoteRes = (await api.getChannelEmotes(channelName, ['7tv', 'twitch', 'bttv', 'ffz'])).sort((a, b) => {
    // sort so that the emotes with a provider of 7tv are first
    if (a.provider === EmoteProvider.STV && b.provider !== EmoteProvider.STV) return -1
    if (a.provider !== EmoteProvider.STV && b.provider === EmoteProvider.STV) return 1
    return 0
  })
  let emotesToAdd: EmoteProv.Emote[]
  if (options.only && options.only.length > 0) {
    emotesToAdd = emoteRes.filter((e) => !currentEmotes.map((e) => e.name).includes(e.code) && options.only!.includes(e.code))
  } else emotesToAdd = emoteRes.filter((e) => !currentEmotes.map((e) => e.name).includes(e.code))
  logger.info(`Found ${emotesToAdd.length} emotes to add`)
  const emotesToRemove = currentEmotes.filter((e) => !emoteRes.map((e) => e.code).includes(e.name || '') && !exclude.includes(e.name || '') && e.name?.[0] !== '_')
  const emoteIds = emotesToAdd.map((emote) => emote.code)
  const emotes = emotesToAdd.reduce<{ [key: string]: string }>((prev, emote, i, arr) => {
    if (emote.provider === EmoteProvider.Twitch) {
      prev[`${channelName.substring(0, 7)}${emote.code}`] = emote.urls.pop()?.url || ''
    } else prev[emote.code] = emote.urls.pop()?.url || ''
    return prev
  }, {})
  // logger.debug(`Emotes: ${JSON.stringify(emotes)}`);

  await removeEmotes(emotesToRemove)
  let failed: string[] = []
  let success: string[] = []

  for (const emoteId of emoteIds) {
    const url = emotes[emoteId]
    const buff = await axios.get(url, { responseType: 'arraybuffer' })
    let gif: { data: Buffer; info: sharp.OutputInfo }
    try {
      gif = (await AnimatedGif.convert(buff.data))!
    } catch (e) {
      logger.error(`${emoteId} errored on conversion, ${e}`)
    }
    await uploadEmote(emoteId, gif)
      .then((e) => success.push(emoteId))
      .catch(async (e) => {
        logger.error(e)
        if (e.message.includes('262144')) {
          logger.error(`Emote ${emoteId} was ${prettyBytes(gif.info.size)}. Too large! Optimizing...`)
          gif = await AnimatedGif.optimize(gif.data)
          await uploadEmote(emoteId, gif)
            .then(() => success.push(emoteId))
            .catch((e) => {
              if (e.message.includes('262144')) logger.error(`Optimized Emote ${emoteId} was ${prettyBytes(gif.data.byteLength)}. Too large! Skipping...`)
              else if (e.message.includes('Maximum number')) {
                logger.error("Maximum Number of Emoji's reached. Exiting Process")
                process.exit(1)
              } else logger.error(e)
              failed.push(emoteId)
            })
        } else if (e.message.includes('Maximum number')) {
          logger.warn("Maximum Number of Emoji's reached. Exiting Process")
          setTimeout(() => process.exit(1), 500)
        } else logger.error(e)
        // process.exit(1);
      })
  }
}

enum EmoteProvider {
  Twitch = 0,
  STV = 1,
  BetterTTV = 2,
  FrankerFaceZ = 3,
}

declare namespace EmoteProv {
  export interface ChannelIdRes {
    id: number
    login: string
    display_name: string
    avatar: string
  }

  export type ChannelEmoteRes = Emote[]
  export type Emote = {
    provider: EmoteProvider
    code: string
    urls: EmoteUrl[]
  }
  interface EmoteUrl {
    size: '1x' | '2x' | '3x' | '4x'
    url: string
  }
}
