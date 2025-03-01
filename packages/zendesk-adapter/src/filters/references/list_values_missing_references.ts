/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Element, isInstanceElement, isReferenceExpression, ReferenceExpression } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { references as referencesUtils } from '@salto-io/adapter-components'
import { inspectValue } from '@salto-io/adapter-utils'
import { FETCH_CONFIG } from '../../config'
import { FilterCreator } from '../../filter'
import { VALUES_TO_SKIP_BY_TYPE } from './missing_references'
import { ZendeskUserConfig } from '../../user_config'

const { createMissingInstance } = referencesUtils
const log = logger(module)

type FieldMissingReferenceDefinition = {
  instanceType: string
  instancePath: string
  fieldNameToValueType: Record<string, string>
  valueIndexToRedefine: number
}

const isNumberStr = (str: string | undefined): boolean => !_.isEmpty(str) && !Number.isNaN(Number(str))

const NON_NUMERIC_MISSING_VALUES_TYPES = ['webhook']

const potentiallyMissingListValues: FieldMissingReferenceDefinition[] = [
  {
    instanceType: 'automation',
    instancePath: 'actions',
    fieldNameToValueType: {
      notification_group: 'group',
      notification_target: 'target',
      notification_webhook: 'webhook',
    },
    valueIndexToRedefine: 0,
  },
  {
    instanceType: 'trigger',
    instancePath: 'actions',
    fieldNameToValueType: {
      notification_group: 'group',
      notification_sms_group: 'group',
      notification_target: 'target',
      notification_webhook: 'webhook',
    },
    valueIndexToRedefine: 0,
  },
]

export const listValuesMissingReferencesOnFetch = (elements: Element[], config: ZendeskUserConfig): void => {
  if (!config[FETCH_CONFIG].enableMissingReferences) {
    return
  }
  potentiallyMissingListValues.forEach(def => {
    const fieldRefTypes = Object.keys(def.fieldNameToValueType)
    const instances = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === def.instanceType)
    instances.forEach(instance => {
      const valueObjects = _.get(instance.value, def.instancePath)
      if (!_.isArray(valueObjects)) {
        return
      }
      valueObjects.forEach(obj => {
        if (!_.isArray(obj.value)) {
          log.debug(`Obj is not an array, for instance ${instance.elemID.getFullName()}, obj: ${inspectValue(obj)}`)
          return
        }
        const valueToRedefine = obj.value[def.valueIndexToRedefine]
        const valueType = def.fieldNameToValueType[obj.field]
        if (
          fieldRefTypes.includes(obj.field) &&
          !isReferenceExpression(valueToRedefine) &&
          !VALUES_TO_SKIP_BY_TYPE[valueType]?.includes(valueToRedefine) &&
          _.isArray(obj.value) && // INCIDENT-3157, Handle cases when for some reason the value is a string
          (isNumberStr(valueToRedefine) || NON_NUMERIC_MISSING_VALUES_TYPES.includes(valueType))
        ) {
          const missingInstance = createMissingInstance(instance.elemID.adapter, valueType, valueToRedefine)
          obj.value[def.valueIndexToRedefine] = new ReferenceExpression(missingInstance.elemID, missingInstance)
        }
      })
    })
  })
}

/**
 * Convert field list values into references, based on predefined configuration.
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'listValuesMissingReferencesFilter',
  onFetch: async (elements: Element[]) => listValuesMissingReferencesOnFetch(elements, config),
})

export default filter
