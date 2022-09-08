import sharp from 'sharp'

import logger from './logger'

// import { execa } from 'execa';

const splitAnimated = function (stream: NodeJS.ReadableStream, output: NodeJS.WritableStream) {
  logger.info('Splitting animated webp')
  // const subprocess = execa('webpmux', [], {});
  // stream.pipe(subprocess.stdin);
  // const buffers = []
  // subprocess.stdout.pipe(output);
  // subprocess.on('exit', (code) => {
  //     if (code !== 0) {
  //         logger.error('Failed to split animated webp', subprocess.stderr.read());
  //     } else logger.info('Finished splitting animated webp');
  // });
}

export const ImageProcessing = {
  splitAnimated,
}

// Convert an Animated WebP file to an Animated GIF
type SharpInput = Buffer | Uint8Array | Uint8ClampedArray | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array | string
export const AnimatedGif = {
  async convert(input: SharpInput, output?: string | NodeJS.WritableStream) {
    // Start Webpmux
    const webp = sharp(input, { animated: true })
    let iInfo: sharp.Metadata
    const gif = await webp.metadata().then((metadata) => {
      iInfo = metadata
      if (metadata.format?.match(/gif|png|jpeg/i)) {
        return webp.withMetadata().resize({ width: 128, height: 128, fit: sharp.fit.contain, position: 'bottom', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      } else if (!metadata.format?.match(/webp/i)) {
        logger.error('Input is not a webp was a ' + metadata.format)
        throw new Error('Input is not a webp')
      }

      return webp
        .withMetadata()
        .resize({ width: 128, height: 128, fit: sharp.fit.contain, position: 'bottom', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toFormat('gif')
        .gif({})
    })

    if (typeof output === 'string') {
      gif.toFile(output).then(
        (info) => {
          logger.info(`Finished converting animated webp to ${info.format} ${info.width}x${info.height} ${info.size} bytes`)
        },
        (err) => {
          logger.error('Failed to convert animated webp to animated gif', err)
        }
      )
    } else if (!output) {
      logger.info(`Returning ${iInfo.format} ${iInfo.width}x${iInfo.height} ${iInfo.size} bytes to animated gif`)
      return gif.toBuffer({ resolveWithObject: true })
    } else {
      // Pipe output to output stream
      logger.info('Piping animated gif to output stream')
      gif.pipe(output)
    }
    // Wait for Webpmux to exit
    // logger.info('Finished converting animated webp to animated gif');
  },
  async optimize(input: SharpInput) {
    const inp = sharp(input, { animated: true })
    const out = await inp
      .withMetadata()
      .resize({ width: 108, height: 108, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .gif({ effort: 8 })
      .toBuffer({ resolveWithObject: true })
    const imagemin = (await import('imagemin')).default
    const imageminGifsicle = (await import('imagemin-gifsicle')).default
    const prettyBytes = (await import('pretty-bytes')).default
    const opt = await imagemin.buffer(out.data, {
      plugins: [imageminGifsicle({ optimizationLevel: 3, interlaced: true, colors: 200 })],
    })
    logger.info(`Optimized ${prettyBytes(opt.byteLength)}`)
    return { data: opt, info: out.info }
  },
}
