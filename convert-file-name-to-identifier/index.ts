export function convertFileNameToIdentifier(text: string): string {
  let output = ``;
  let state:
    | `waitingForFirstToken`
    | `afterToken`
    | `maybeShortening`
    | `insideShortening`
    | `insideWord` = `waitingForFirstToken`;

  for (const character of text.trim()) {
    if (/\s/.test(character) || character === `_` || character === `-`) {
      switch (state) {
        case `waitingForFirstToken`:
          break;

        case `afterToken`:
          break;

        case `maybeShortening`:
          state = `afterToken`;
          break;

        case `insideShortening`:
          state = `afterToken`;
          break;

        case `insideWord`:
          state = `afterToken`;
          break;
      }
    } else if (/[A-Z]/.test(character)) {
      switch (state) {
        case `waitingForFirstToken`:
          state = `maybeShortening`;
          output += character.toLowerCase();
          break;
        case `afterToken`:
          state = `maybeShortening`;
          output += `_`;
          output += character.toLowerCase();
          break;

        case `maybeShortening`:
          state = `insideShortening`;
          output += character.toLowerCase();
          break;

        case `insideShortening`:
          output += character.toLowerCase();
          break;

        case `insideWord`:
          state = `maybeShortening`;
          output += `_`;
          output += character.toLowerCase();
          break;
      }
    } else {
      switch (state) {
        case `waitingForFirstToken`:
          state = `insideWord`;
          output += character;
          break;

        case `afterToken`:
          state = `insideWord`;
          output += `_`;
          output += character;
          break;

        case `maybeShortening`:
          state = `insideWord`;
          output += character;
          break;

        case `insideShortening`:
          state = `insideWord`;
          output = `${output.slice(0, output.length - 1)}_${
            output[output.length - 1]
          }${character}`;
          break;

        case `insideWord`:
          output += character;
          break;
      }
    }
  }

  return output;
}
