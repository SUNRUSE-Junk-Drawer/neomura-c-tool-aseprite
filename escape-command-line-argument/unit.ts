import { escapeCommandLineArgument } from ".";

it(`escapeCommandLineArgument`, () => {
  expect(escapeCommandLineArgument(`a 'string' to be escaped`)).toEqual(
    `'a '\\''string'\\'' to be escaped'`
  );
});
