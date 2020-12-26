# neomura > c tool aseprite

cli tool to convert aseprite files (\*.ase) to c source (\*.c) and header (\*.h)
files compatible with the
[sprites library](https://github.com/neomura/c-library-sprites).

[mit licensed](./license.md).

## dependencies

- nodejs 14.15.3 or later.
- aseprite available via path (use
  [setup-aseprite-cli-action](https://github.com/neomura/setup-aseprite-cli-action)
  in continuous integration).

## installation/usage

### version tracked to project-local package.json (recommended)

within a terminal in the same directory as the package.json:

`npm install --save-dev @neomura/c-tool-aseprite`

then, to convert a file:

`npx neomura-c-tool-aseprite [options]`

### globally installed (not recommended)

within a terminal:

`npm install --global @neomura/c-tool-aseprite`

then, to convert a file:

`neomura-c-tool-aseprite [options]`

### options

#### aseprite file

the path to the aseprite file to convert.

#### neomura header file

the path to the neomura.h file from the
[c library](https://github.com/neomura/c-library).

#### neomura sprites header file

the path to the sprites.h file from the
[sprites library](https://github.com/neomura/c-library-sprites).

#### output

the path to the source (\*.c) and header (\*.h) files to create; for example,
`a/path/to/a/file` will produce `a/path/to/a/file.c` and `a/path/to/a/file.h`.

### example h file

```c
#pragma once

#include "../../fictional/neomura/header/file/from/submodules.h"
#include "../../fictional/neomura/sprites/header/file/from/submodules.h"

extern const sprite_t taken_from_name_of_aseprite_file;

extern const sprite_animation_t tag_a_name;
extern const sprite_animation_t tag_b_name;
extern const sprite_animation_t tag_c_name;
```

### aseprite notes

only visible layers will be included in image data.

the center of the canvas is taken as the origin of the sprite.
