import { promises } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { spawn } from "cross-spawn";
import { v4 } from "uuid";

function scenario(
  description: string,
  args: (temporaryDirectory: string) => ReadonlyArray<string>,
  exitCode: number,
  stdout: string,
  stderr: RegExp,
  filesToCopyToTemporaryDirectory: ReadonlyArray<{
    readonly from: string;
    readonly to: string;
  }>,
  filesExpected: ReadonlyArray<{
    readonly from: string;
    readonly to: string;
  }>
): void {
  describe(description, () => {
    let temporaryDirectory: string;
    let actualExitCode: null | number = null;
    let actualStdout = ``;
    let actualStderr = ``;
    const resultingFiles: string[] = [];

    beforeAll(async () => {
      temporaryDirectory = join(tmpdir(), v4());

      await promises.mkdir(temporaryDirectory, { recursive: true });

      for (const fileToCopyToTemporaryDirectory of filesToCopyToTemporaryDirectory) {
        const to = join(temporaryDirectory, fileToCopyToTemporaryDirectory.to);

        await promises.mkdir(dirname(to), { recursive: true });

        await promises.copyFile(fileToCopyToTemporaryDirectory.from, to);
      }

      await new Promise<void>((resolve, reject) => {
        const childProcess = spawn(`node`, [`.`, ...args(temporaryDirectory)]);

        childProcess.stdout.on(`data`, (data) => {
          actualStdout += data;
        });

        childProcess.stderr.on(`data`, (data) => {
          actualStderr += data;
        });

        childProcess.on(`close`, (code) => {
          actualExitCode = code;
          resolve();
        });

        childProcess.on(`error`, reject);
      });

      async function recurse(path: string): Promise<void> {
        const children = await promises.readdir(path);

        for (const child of children) {
          const childPath = join(path, child);

          const stats = await promises.stat(childPath);

          if (stats.isFile()) {
            resultingFiles.push(childPath);
          } else if (stats.isDirectory()) {
            await recurse(childPath);
          } else {
            throw new Error(
              `"${childPath}" is neither a file nor a directory.`
            );
          }
        }
      }

      await recurse(temporaryDirectory);
    });

    afterAll(async () => {
      await promises.rm(temporaryDirectory, { recursive: true, force: true });
    });

    it(`returns the expected exit code`, () => {
      expect(actualExitCode).toEqual(exitCode);
    });

    it(`generates the expected stdout`, () => {
      expect(actualStdout).toEqual(stdout);
    });

    it(`generates the expected stderr`, () => {
      expect(actualStderr).toMatch(stderr);
    });

    it(`generates the expected files`, async () => {
      for (const expected of filesExpected) {
        expect(resultingFiles).toContain(join(temporaryDirectory, expected.to));
      }

      for (const actual of resultingFiles) {
        expect(
          filesExpected.map((expected) => join(temporaryDirectory, expected.to))
        ).toContain(actual);
      }
    });

    it(`includes the expected file contents`, async () => {
      for (const actual of resultingFiles) {
        const match = filesExpected.find(
          (expected) => join(temporaryDirectory, expected.to) === actual
        );
        if (match !== undefined) {
          const expectedContent = await promises.readFile(match.from);
          const actualContent = await promises.readFile(actual);

          expect(expectedContent).toEqual(actualContent);
        }
      }

      // fs.promises.readFile appears to have a performance problem with multi-megabyte binary files.
    }, 30000);
  });
}

scenario(
  `help`,
  () => [`--help`],
  0,
  `neomura-c-tool-aseprite (0.0.0) - cli tool to convert aseprite files (*.ase) to c source (*.c) and header (*.h) files compatible with the sprites library.
  usage: neomura-c-tool-aseprite (0.0.0) [options]
  options:
    -h, --help, /?: display this message
    -af, --aseprite-file [path]: the aseprite file.
    -nhf, --neomura-header-file [path]: the neomura library header file.
    -nshf, --neomura-sprites-header-file [path]: the neomura sprites library header file.
    -o, --output [path]: the base name of the header (*.h) and source (*.c) files to produce.
    -rr, --refresh-rate [hertz]: the refresh rate of the game the sprite will be used in.
`,
  /^$/,
  [],
  []
);

scenario(
  `successful without existing`,
  (temporaryDirectory) => [
    `--aseprite-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `example`,
      `input`,
      `aseprite-file.ase`
    ),
    `--neomura-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--neomura-sprites-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `sprites`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--refresh-rate`,
    `60`,
    `--output`,
    join(temporaryDirectory, `path`, `to`, `nested`, `output`, `file`),
  ],
  0,
  ``,
  /^$/,
  [
    {
      from: `example.ase`,
      to: join(`path`, `to`, `example`, `input`, `aseprite-file.ase`),
    },
  ],
  [
    {
      from: `example.ase`,
      to: join(`path`, `to`, `example`, `input`, `aseprite-file.ase`),
    },
    {
      from: `example.c`,
      to: join(`path`, `to`, `nested`, `output`, `file.c`),
    },
    {
      from: `example.h`,
      to: join(`path`, `to`, `nested`, `output`, `file.h`),
    },
  ]
);

scenario(
  `successful with existing`,
  (temporaryDirectory) => [
    `--aseprite-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `example`,
      `input`,
      `aseprite-file.ase`
    ),
    `--neomura-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--neomura-sprites-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `sprites`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--refresh-rate`,
    `60`,
    `--output`,
    join(temporaryDirectory, `path`, `to`, `nested`, `output`, `file`),
  ],
  0,
  ``,
  /^$/,
  [
    {
      from: `example.ase`,
      to: join(`path`, `to`, `example`, `input`, `aseprite-file.ase`),
    },
    {
      from: `example-non-aseprite-file.txt`,
      to: join(`path`, `to`, `nested`, `output`, `file.c`),
    },
    {
      from: `example-non-aseprite-file.txt`,
      to: join(`path`, `to`, `nested`, `output`, `file.h`),
    },
  ],
  [
    {
      from: `example.ase`,
      to: join(`path`, `to`, `example`, `input`, `aseprite-file.ase`),
    },
    {
      from: `example.c`,
      to: join(`path`, `to`, `nested`, `output`, `file.c`),
    },
    {
      from: `example.h`,
      to: join(`path`, `to`, `nested`, `output`, `file.h`),
    },
  ]
);

scenario(
  `nonexistent file`,
  (temporaryDirectory) => [
    `--aseprite-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `example`,
      `input`,
      `aseprite-file.ase`
    ),
    `--neomura-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--neomura-sprites-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `sprites`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--refresh-rate`,
    `60`,
    `--output`,
    join(temporaryDirectory, `path`, `to`, `nested`, `output`, `file`),
  ],
  1,
  ``,
  /^"aseprite --batch --list-tags --trim [^ ]+[\\\/]path[\\\/]to[\\\/]example[\\\/]input[\\\/]aseprite-file\.ase --data [^ ]+[\\\/]data\.json --filename-format {frame} --sheet [^ ]+[\\\/]sheet\.png" produced an empty data file\.\r?\n$/,
  [],
  []
);

scenario(
  `non-aseprite file`,
  (temporaryDirectory) => [
    `--aseprite-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `example`,
      `input`,
      `aseprite-file.ase`
    ),
    `--neomura-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--neomura-sprites-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `sprites`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--refresh-rate`,
    `60`,
    `--output`,
    join(temporaryDirectory, `path`, `to`, `nested`, `output`, `file`),
  ],
  1,
  ``,
  /^"aseprite --batch --list-tags --trim [^ ]+[\\\/]path[\\\/]to[\\\/]example[\\\/]input[\\\/]aseprite-file\.ase --data [^ ]+[\\\/]data\.json --filename-format {frame} --sheet [^ ]+[\\\/]sheet\.png" produced an empty data file\.\r?\n$/,
  [
    {
      from: `example-non-aseprite-file.txt`,
      to: join(`path`, `to`, `example`, `input`, `aseprite-file.ase`),
    },
  ],
  [
    {
      from: `example-non-aseprite-file.txt`,
      to: join(`path`, `to`, `example`, `input`, `aseprite-file.ase`),
    },
  ]
);

scenario(
  `incompatible duration`,
  (temporaryDirectory) => [
    `--aseprite-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `example`,
      `input`,
      `aseprite-file.ase`
    ),
    `--neomura-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--neomura-sprites-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `sprites`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--refresh-rate`,
    `60`,
    `--output`,
    join(temporaryDirectory, `path`, `to`, `nested`, `output`, `file`),
  ],
  1,
  ``,
  /^frame 8's duration of 51 milliseconds is incompatible with the refresh rate of 60 hertz\.\r?\n$/,
  [
    {
      from: `example-with-incompatible-duration.ase`,
      to: join(`path`, `to`, `example`, `input`, `aseprite-file.ase`),
    },
  ],
  [
    {
      from: `example-with-incompatible-duration.ase`,
      to: join(`path`, `to`, `example`, `input`, `aseprite-file.ase`),
    },
  ]
);

scenario(
  `too many frames in tag`,
  (temporaryDirectory) => [
    `--aseprite-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `example`,
      `input`,
      `aseprite-file.ase`
    ),
    `--neomura-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--neomura-sprites-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `sprites`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--refresh-rate`,
    `60`,
    `--output`,
    join(temporaryDirectory, `path`, `to`, `nested`, `output`, `file`),
  ],
  1,
  ``,
  /^tag "overly_long"'s duration of 65538 frames is longer than the limit of 65535\.\r?\n$/,
  [
    {
      from: `example-with-too-many-frames-in-tag.ase`,
      to: join(`path`, `to`, `example`, `input`, `aseprite-file.ase`),
    },
  ],
  [
    {
      from: `example-with-too-many-frames-in-tag.ase`,
      to: join(`path`, `to`, `example`, `input`, `aseprite-file.ase`),
    },
  ]
);

scenario(
  `aseprite file empty`,
  (temporaryDirectory) => [
    `--aseprite-file`,
    ``,
    `--neomura-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--neomura-sprites-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `sprites`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--refresh-rate`,
    `60`,
    `--output`,
    join(temporaryDirectory, `path`, `to`, `nested`, `output`, `file`),
  ],
  1,
  ``,
  /^argument for command-line parameter "-af"\/"--aseprite-file" must contain at least 1 character\(s\)\.\r?\n$/,
  [],
  []
);

scenario(
  `header file empty`,
  (temporaryDirectory) => [
    `--aseprite-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `example`,
      `input`,
      `aseprite-file.ase`
    ),
    `--neomura-header-file`,
    ``,
    `--neomura-sprites-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `sprites`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--refresh-rate`,
    `60`,
    `--output`,
    join(temporaryDirectory, `path`, `to`, `nested`, `output`, `file`),
  ],
  1,
  ``,
  /^argument for command-line parameter "-nhf"\/"--neomura-header-file" must contain at least 1 character\(s\)\.\r?\n$/,
  [],
  []
);

scenario(
  `sprites header file empty`,
  (temporaryDirectory) => [
    `--aseprite-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `example`,
      `input`,
      `aseprite-file.ase`
    ),
    `--neomura-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--neomura-sprites-header-file`,
    ``,
    `--refresh-rate`,
    `60`,
    `--output`,
    join(temporaryDirectory, `path`, `to`, `nested`, `output`, `file`),
  ],
  1,
  ``,
  /^argument for command-line parameter "-nshf"\/"--neomura-sprites-header-file" must contain at least 1 character\(s\)\.\r?\n$/,
  [],
  []
);

scenario(
  `refresh rate zero`,
  (temporaryDirectory) => [
    `--aseprite-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `example`,
      `input`,
      `aseprite-file.ase`
    ),
    `--neomura-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--neomura-sprites-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `sprites`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--refresh-rate`,
    `0`,
    `--output`,
    join(temporaryDirectory, `path`, `to`, `nested`, `output`, `file`),
  ],
  1,
  ``,
  /^argument for command-line parameter "-rr"\/"--refresh-rate" must be at least 1\.\r?\n$/,
  [],
  []
);

scenario(
  `output empty`,
  (temporaryDirectory) => [
    `--aseprite-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `example`,
      `input`,
      `aseprite-file.ase`
    ),
    `--neomura-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--neomura-sprites-header-file`,
    join(
      temporaryDirectory,
      `path`,
      `to`,
      `fictional`,
      `neomura`,
      `sprites`,
      `header`,
      `file`,
      `from`,
      `submodules.h`
    ),
    `--refresh-rate`,
    `60`,
    `--output`,
    ``,
  ],
  1,
  ``,
  /^argument for command-line parameter "-o"\/"--output" must contain at least 1 character\(s\)\.\r?\n$/,
  [],
  []
);
