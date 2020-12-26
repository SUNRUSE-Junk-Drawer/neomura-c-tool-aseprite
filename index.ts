import { v4 } from "uuid";
import { promises, createReadStream } from "fs";
import { basename, dirname, join, parse, relative } from "path";
import { tmpdir } from "os";
import { spawn } from "cross-spawn";
import { version, description, bin } from "./package.json";
import { PNG } from "pngjs";
import {
  parseCommandLineArguments,
  runMain,
} from "@neomura/js-command-line-helpers";
import { convertFileNameToIdentifier } from "./convert-file-name-to-identifier";

runMain(async () => {
  const commandLineArguments = parseCommandLineArguments(
    `${Object.keys(bin)} (${version})`,
    `${description}`,
    {
      strings: {
        asepriteFile: {
          name: {
            short: `af`,
            long: `aseprite-file`,
          },
          helpText: `the aseprite file.`,
          argumentHelpText: `path`,
          length: {
            minimum: 1,
            maximum: Number.POSITIVE_INFINITY,
          },
        },
        neomuraHeaderFile: {
          name: {
            short: `nhf`,
            long: `neomura-header-file`,
          },
          helpText: `the neomura library header file.`,
          argumentHelpText: `path`,
          length: {
            minimum: 1,
            maximum: Number.POSITIVE_INFINITY,
          },
        },
        neomuraSpritesHeaderFile: {
          name: {
            short: `nshf`,
            long: `neomura-sprites-header-file`,
          },
          helpText: `the neomura sprites library header file.`,
          argumentHelpText: `path`,
          length: {
            minimum: 1,
            maximum: Number.POSITIVE_INFINITY,
          },
        },
        output: {
          name: {
            short: `o`,
            long: `output`,
          },
          helpText: `the base name of the header (*.h) and source (*.c) files to produce.`,
          argumentHelpText: `path`,
          length: {
            minimum: 1,
            maximum: Number.POSITIVE_INFINITY,
          },
        },
      },
      integers: {
        refreshRate: {
          name: {
            short: `rr`,
            long: `refresh-rate`,
          },
          helpText: `the refresh rate of the game the sprite will be used in.`,
          argumentHelpText: `hertz`,
          minimum: 1,
          maximum: Number.POSITIVE_INFINITY,
        },
      },
    }
  );

  const temporaryDirectory = join(tmpdir(), v4());

  const dataFile = join(temporaryDirectory, `data.json`);
  const sheetFile = join(temporaryDirectory, `sheet.png`);

  let command = ``;

  try {
    let exitCode: null | number = null;
    let stdout = ``;
    let stderr = ``;

    await new Promise<void>((resolve, reject) => {
      const args = [
        `--batch`,
        `--list-tags`,
        `--trim`,
        commandLineArguments.strings.asepriteFile,
        `--data`,
        dataFile,
        `--filename-format`,
        `{frame}`,
        `--sheet`,
        sheetFile,
      ];

      command = `aseprite ${args.join(` `)}`;

      // These diverge for Win32 by necessity, so full coverage isn't possible
      // from any individual OS.

      /* istanbul ignore next */
      const childProcess = spawn(
        process.platform === `win32` ? `cmd` : `aseprite`,
        process.platform === `win32` ? [`/c`, `aseprite`, ...args] : args
      );

      command = childProcess.spawnargs.join(` `);

      childProcess.stdout.on(`data`, (data) => {
        stdout += data;
      });

      /* istanbul ignore next */
      childProcess.stderr.on(`data`, (data) => {
        // Aseprite CLI does not appear to write to stderr.
        stderr += data;
      });

      childProcess.on(`close`, (code) => {
        exitCode = code;
        resolve();
      });

      childProcess.on(`error`, reject);
    });

    /* istanbul ignore next */
    if (exitCode !== 0 || stderr.trim() !== ``) {
      // Aseprite CLI does not appear to use exit codes.
      throw `"${command}" exited with code ${exitCode}; stdout ${stdout}; stderr ${stderr}.`;
    }

    const dataJson = await promises.readFile(dataFile, `utf8`);

    if (dataJson === ``) {
      throw `"${command}" produced an empty data file.`;
    }

    const data: {
      readonly frames: {
        readonly [index: number]: {
          readonly frame: {
            readonly x: number;
            readonly y: number;
            readonly w: number;
            readonly h: number;
          };
          readonly spriteSourceSize: { x: number; y: number };
          readonly sourceSize: { w: number; h: number };
          readonly duration: number;
        };
      };
      readonly meta: {
        readonly frameTags: ReadonlyArray<{
          readonly name: string;
          readonly from: number;
          readonly to: number;
          readonly direction: `forward` | `reverse` | `pingpong`;
        }>;
      };
    } = JSON.parse(dataJson);

    const png = await new Promise<PNG>((resolve, reject) => {
      const png = new PNG();
      createReadStream(sheetFile)
        .pipe(png)
        .on(`parsed`, () => {
          resolve(png);
        })
        .on(`error`, reject);
    });

    const frames: ReadonlyArray<{
      readonly width: number;
      readonly height: number;
      readonly xOffset: number;
      readonly yOffset: number;
      readonly duration: number;
      readonly rgba: Buffer;
    }> = Object.keys(data.frames).map((_, index) => {
      const frame = data.frames[index];

      const width = frame.frame.w;

      /* istanbul ignore next */
      if (width > 65535) {
        // https://github.com/aseprite/aseprite/issues/2596
        throw `frame ${
          index + 1
        }'s width of ${width} is wider than the limit of 65535 pixels.`;
      }

      const height = frame.frame.h;

      /* istanbul ignore next */
      if (height > 65535) {
        // https://github.com/aseprite/aseprite/issues/2596
        throw `frame ${
          index + 1
        }'s height of ${height} is taller than the limit of 65535 pixels.`;
      }

      const xOffset = frame.spriteSourceSize.x - frame.sourceSize.w / 2;

      /* istanbul ignore next */
      if (xOffset > 32767) {
        // https://github.com/aseprite/aseprite/issues/2596
        throw `frame ${
          index + 1
        }'s x offset of ${xOffset} beyond the limit of 32767 pixels.`;
      }

      /* istanbul ignore next */
      if (xOffset < -32768) {
        // https://github.com/aseprite/aseprite/issues/2596
        throw `frame ${
          index + 1
        }'s x offset of ${xOffset} beyond the limit of -32768 pixels.`;
      }

      const yOffset = frame.spriteSourceSize.y - frame.sourceSize.h / 2;

      /* istanbul ignore next */
      if (yOffset > 32767) {
        // https://github.com/aseprite/aseprite/issues/2596
        throw `frame ${
          index + 1
        }'s y offset of ${yOffset} beyond the limit of 32767 pixels.`;
      }

      /* istanbul ignore next */
      if (yOffset < -32768) {
        // https://github.com/aseprite/aseprite/issues/2596
        throw `frame ${
          index + 1
        }'s y offset of ${yOffset} beyond the limit of -32768 pixels.`;
      }

      if (
        (frame.duration * commandLineArguments.integers.refreshRate) % 1000 !==
        0
      ) {
        throw `frame ${index + 1}'s duration of ${
          frame.duration
        } milliseconds is incompatible with the refresh rate of ${
          commandLineArguments.integers.refreshRate
        } hertz.`;
      }

      const duration =
        (frame.duration * commandLineArguments.integers.refreshRate) / 1000;

      const rgba = Buffer.alloc(frame.frame.w * frame.frame.h * 4);

      for (let y = 0; y < frame.frame.h; y++) {
        for (let x = 0; x < frame.frame.w; x++) {
          const alpha =
            png.data[
              (y + frame.frame.y) * png.width * 4 + (x + frame.frame.x) * 4 + 3
            ];

          const alphaCoefficient = alpha / 255;

          for (let channel = 0; channel < 3; channel++) {
            rgba[y * frame.frame.w + x + channel] = Math.floor(
              png.data[
                (y + frame.frame.y) * png.width * 4 +
                  (x + frame.frame.x) * 4 +
                  channel
              ] * alphaCoefficient
            );
          }

          rgba[y * frame.frame.w + x + 3] = 255 - alpha;
        }
      }

      return {
        width,
        height,
        xOffset,
        yOffset,
        duration,
        rgba: png.data,
      };
    });

    /* istanbul ignore next */
    if (frames.length > 65535) {
      // https://github.com/aseprite/aseprite/issues/2597
      throw `the frame count ${frames.length} exceeds the limit of 65535.`;
    }

    const tags: ReadonlyArray<{
      readonly name: string;
      readonly indices: ReadonlyArray<number>;
      readonly duration: number;
    }> = data.meta.frameTags.map((tag) => {
      const indices: number[] = [];

      switch (tag.direction) {
        case `forward`:
          for (let index = tag.from; index <= tag.to; index++) {
            indices.push(index);
          }
          break;

        case `reverse`:
          for (let index = tag.to; index >= tag.from; index--) {
            indices.push(index);
          }
          break;

        case `pingpong`:
          for (let index = tag.from; index < tag.to; index++) {
            indices.push(index);
          }

          for (let index = tag.to; index > tag.from; index--) {
            indices.push(index);
          }
          break;

        /* istanbul ignore next */
        default:
          // We cannot force Aseprite to generate an unexpected direction.
          throw `tag "${tag.name}" uses unimplemented direction "${tag.direction}".`;
      }

      let duration = 0;

      for (const index of indices) {
        duration += frames[index].duration;
      }

      if (duration > 65535) {
        throw `tag "${tag.name}"'s duration of ${duration} frames is longer than the limit of 65535.`;
      }

      return { name: tag.name, indices, duration };
    });

    const name = convertFileNameToIdentifier(
      parse(commandLineArguments.strings.asepriteFile).name
    );

    const header = `#pragma once

#include "${relative(
      dirname(commandLineArguments.strings.asepriteFile),
      commandLineArguments.strings.neomuraHeaderFile
    )}"
#include "${relative(
      dirname(commandLineArguments.strings.asepriteFile),
      commandLineArguments.strings.neomuraSpritesHeaderFile
    )}"

extern const sprite_t ${name};

${tags.map((tag) => `extern const sprite_animation_t ${tag.name};`).join(`
`)}
`;

    const source = `#include "${basename(
      commandLineArguments.strings.asepriteFile
    )}.h"

static const u16_t ${name}_widths[${frames.length}] = { ${frames
      .map((frame) => frame.width)
      .join(`, `)} };
static const u16_t ${name}_heights[${frames.length}] = { ${frames
      .map((frame) => frame.height)
      .join(`, `)} };
static const s16_t ${name}_x_offsets[${frames.length}] = { ${frames
      .map((frame) => frame.xOffset)
      .join(`, `)} };
static const s16_t ${name}_y_offsets[${frames.length}] = { ${frames
      .map((frame) => frame.yOffset)
      .join(`, `)} };
static const u16_t ${name}_durations[${frames.length}] = { ${frames
      .map((frame) => frame.duration)
      .join(`, `)} };
${frames.map(
  (frame, index) =>
    `static const u8_t ${name}_rgba_${index}[${
      frame.rgba.length
    }] = { ${Array.from(frame.rgba)
      .map((byte) => `0x${byte.toString(16)}`)
      .join(`, `)} };`
).join(`
`)}
static const u8_t * ${name}_rgba[${frames.length}] = { ${frames
      .map((_, index) => `&${name}_rgba_${index}`)
      .join(`, `)} };

const sprite_t ${name} = {
  &${name}_widths,
  &${name}_heights,
  &${name}_x_offsets,
  &${name}_y_offsets,
  &${name}_durations,
  &${name}_rgba,
  ${frames.length}
};

${tags.map(
  (tag) =>
    `const u16_t ${tag.name}_indices[${
      tag.indices.length
    }] = { ${tag.indices.join(`, `)} };`
).join(`
`)}

${tags.map(
  (tag) => `const sprite_animation_t ${tag.name} = {
  &${name},
  &${tag.name}_indices,
  ${tag.indices.length},
  ${tag.duration}
};`
).join(`

`)}
`;

    await promises.mkdir(dirname(commandLineArguments.strings.output), {
      recursive: true,
    });

    const headerFile = `${commandLineArguments.strings.output}.h`;
    const sourceFile = `${commandLineArguments.strings.output}.c`;

    await promises.writeFile(headerFile, header);
    await promises.writeFile(sourceFile, source);
  } finally {
    await promises.rm(temporaryDirectory, { recursive: true, force: true });
  }
});
