import { convertFileNameToIdentifier } from ".";

describe(`convertFileNameToIdentifier`, () => {
  const scenarios: ReadonlyArray<readonly [string, string]> = [
    [`test`, `test`],
    [`Test`, `test`],
    [
      `  \n \r \t  Test String  \n \t \r With TXT White Space \t \t \r \n   `,
      `test_string_with_txt_white_space`,
    ],
    [`test_snake_cased_string`, `test_snake_cased_string`],
    [`test-kebab-cased-string`, `test_kebab_cased_string`],
    [`TEST_SNAKE_CASED_STRING`, `test_snake_cased_string`],
    [`TEST-KEBAB-CASED-STRING`, `test_kebab_cased_string`],
    [`_test_snake_cased_string`, `test_snake_cased_string`],
    [`-test-kebab-cased-string`, `test_kebab_cased_string`],
    [`TestPascalCasedTXTString`, `test_pascal_cased_txt_string`],
    [`testCamelCasedTXTString`, `test_camel_cased_txt_string`],
    [`TestPascalCasedStringTXT`, `test_pascal_cased_string_txt`],
    [`testCamelCasedStringTXT`, `test_camel_cased_string_txt`],
    [`TXTTestPascalCasedString`, `txt_test_pascal_cased_string`],
    [`TestPascalCasedTXString`, `test_pascal_cased_tx_string`],
    [`testCamelCasedTXString`, `test_camel_cased_tx_string`],
    [`TestPascalCasedStringTX`, `test_pascal_cased_string_tx`],
    [`testCamelCasedStringTX`, `test_camel_cased_string_tx`],
    [`TXTestPascalCasedString`, `tx_test_pascal_cased_string`],
    [`TestPascalCasedTString`, `test_pascal_cased_t_string`],
    [`testCamelCasedTString`, `test_camel_cased_t_string`],
    [`TestPascalCasedStringT`, `test_pascal_cased_string_t`],
    [`testCamelCasedStringT`, `test_camel_cased_string_t`],
    [`TTestPascalCasedString`, `t_test_pascal_cased_string`],
    [`TXT`, `txt`],
    [`A B C`, `a_b_c`],
  ];

  for (const scenario of scenarios) {
    describe(`given ${JSON.stringify(scenario[0])}`, () => {
      let output: string;

      beforeAll(() => {
        output = convertFileNameToIdentifier(scenario[0]);
      });

      it(`returns ${JSON.stringify(scenario[1])}`, () => {
        expect(output).toEqual(scenario[1]);
      });
    });
  }
});
