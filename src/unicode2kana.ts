import * as Types from './types.ts'
import { convertAddress } from './convertAddress.ts'
import { convertEnglish } from './convertEnglish.ts'
import { convertAlphabets } from './convertAlphabets.ts'
import { convertNumbers } from './convertNumbers.ts'
import { convertKana } from './convertKana.ts'
import { switchMode } from './switchMode.ts'

export function unicode2kana(brailleText: string, options: Types.EngineOptions): string {

  let result = convertAddress(brailleText)
  result = convertEnglish(result)
  result = convertAlphabets(result)
  result = convertNumbers(result)
  result = convertKana(result)
  result = switchMode(result, options.mode)

  return result
}