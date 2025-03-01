/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ChangeValidator } from '@salto-io/adapter-api'
import { builtInInstancesValidator } from './built_in_instances_validator'
import { requiredFieldsValidator } from './required_fields_validator'
import { readOnlyFieldsValidator } from './read_only_fields_validator'

export {
  TYPE_NAME_TO_READ_ONLY_FIELDS_MODIFICATION,
  TYPE_NAME_TO_READ_ONLY_FIELDS_ADDITION,
} from './read_only_fields_validator'

export default (): Record<string, ChangeValidator> => ({
  builtInInstances: builtInInstancesValidator,
  requiredFields: requiredFieldsValidator,
  readOnlyFields: readOnlyFieldsValidator,
})
