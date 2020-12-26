export function escapeCommandLineArgument(argument: string): string {
  return `'${argument.replace(/'/g, `'\\''`)}'`;
}
