/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  ChangeGroupIdFunction,
  getChangeData,
  ChangeGroupId,
  ChangeId,
  isInstanceChange,
  isAdditionChange,
  isReferenceExpression,
  InstanceElement,
  AdditionChange,
} from '@salto-io/adapter-api'
import wu from 'wu'
import { apiNameSync, isInstanceOfCustomObjectChangeSync, isInstanceOfTypeChangeSync } from './filters/utils'
import {
  ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
  SBAA_APPROVAL_CONDITION,
  SBAA_APPROVAL_RULE,
  SBAA_CONDITIONS_MET,
  METADATA_CHANGE_GROUP,
  groupIdForInstanceChangeGroup,
  CPQ_PRICE_RULE,
  CPQ_CONDITIONS_MET,
  CPQ_PRICE_CONDITION,
  ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP,
  CPQ_PRICE_CONDITION_RULE_FIELD,
  CPQ_ERROR_CONDITION_RULE_FIELD,
  ADD_CPQ_CUSTOM_PRODUCT_RULE_AND_CONDITION_GROUP,
  CPQ_PRODUCT_RULE,
  CPQ_ERROR_CONDITION,
  CPQ_QUOTE_TERM,
  CPQ_TERM_CONDITION,
  ADD_CPQ_QUOTE_TERM_AND_CONDITION_GROUP,
} from './constants'

const getGroupId = (change: Change): string => {
  if (!isInstanceChange(change) || !isInstanceOfCustomObjectChangeSync(change)) {
    return METADATA_CHANGE_GROUP
  }
  const typeName = apiNameSync(getChangeData(change).getTypeSync()) ?? 'UNKNOWN'
  return groupIdForInstanceChangeGroup(change.action, typeName)
}

/**
 * Returns the changes that should be part of the special deploy group for adding Rule and Condition instances that
 * contain a circular dependency.
 *
 * @ref deployRulesAndConditionsGroup
 */
const getAddCustomRuleAndConditionGroupChangeIds = (
  changes: Map<ChangeId, Change>,
  ruleTypeName: string,
  ruleConditionFieldName: string,
  conditionTypeName: string,
  conditionRuleFieldName: string,
): Set<ChangeId> => {
  const addedInstancesChanges = wu(changes.entries())
    .filter(([_changeId, change]) => isAdditionChange(change))
    .filter(([_changeId, change]) => isInstanceChange(change))
    .toArray() as [ChangeId, AdditionChange<InstanceElement>][]
  const customRuleAdditions = addedInstancesChanges
    .filter(([_changeId, change]) => isInstanceOfTypeChangeSync(ruleTypeName)(change))
    .filter(([_changeId, change]) => getChangeData(change).value[ruleConditionFieldName] === 'Custom')
  const customRuleElemIds = new Set(
    customRuleAdditions.map(([_changeId, change]) => getChangeData(change).elemID.getFullName()),
  )
  const customConditionAdditions = addedInstancesChanges
    .filter(([_changeId, change]) => isInstanceOfTypeChangeSync(conditionTypeName)(change))
    .filter(([_changeId, change]) => {
      const rule = getChangeData(change).value[conditionRuleFieldName]
      return isReferenceExpression(rule) && customRuleElemIds.has(rule.elemID.getFullName())
    })
  return new Set(customRuleAdditions.concat(customConditionAdditions).map(([changeId]) => changeId))
}

/**
 * Returns the changes that should be part of the special deploy group for adding sbaa__ApprovalRule__c
 * instances with sbaa__ConditionsMet = 'Custom' and their corresponding sbaa__ApprovalCondition instances.
 */
const getAddSbaaCustomApprovalRuleAndConditionGroupChangeIds = (changes: Map<ChangeId, Change>): Set<ChangeId> =>
  getAddCustomRuleAndConditionGroupChangeIds(
    changes,
    SBAA_APPROVAL_RULE,
    SBAA_CONDITIONS_MET,
    SBAA_APPROVAL_CONDITION,
    SBAA_APPROVAL_RULE,
  )

/**
 * Returns the changes that should be part of the special deploy group for adding SBQQ__PriceRule__c
 * instances with SBQQ__ConditionsMet = 'Custom' and their corresponding SBQQ__PriceCondition instances.
 */
const getAddCpqCustomPriceRuleAndConditionGroupChangeIds = (changes: Map<ChangeId, Change>): Set<ChangeId> =>
  getAddCustomRuleAndConditionGroupChangeIds(
    changes,
    CPQ_PRICE_RULE,
    CPQ_CONDITIONS_MET,
    CPQ_PRICE_CONDITION,
    CPQ_PRICE_CONDITION_RULE_FIELD,
  )

/**
 * Returns the changes that should be part of the special deploy group for adding SBQQ__ProductRule__c
 * instances with SBQQ__ConditionsMet = 'Custom' and their corresponding SBQQ__ProductCondition instances.
 */
const getAddCpqCustomProductRuleAndConditionGroupChangeIds = (changes: Map<ChangeId, Change>): Set<ChangeId> =>
  getAddCustomRuleAndConditionGroupChangeIds(
    changes,
    CPQ_PRODUCT_RULE,
    CPQ_CONDITIONS_MET,
    CPQ_ERROR_CONDITION,
    CPQ_ERROR_CONDITION_RULE_FIELD,
  )

/**
 * Returns the changes that should be part of the special deploy group for adding SBQQ__QuoteTerm__c
 * instances with SBQQ__ConditionsMet = 'Custom' and their corresponding SBQQ__ProductCondition instances.
 */
const getAddCpqCustomQuoteTermsAndConditionsGroupChangeIds = (changes: Map<ChangeId, Change>): Set<ChangeId> =>
  getAddCustomRuleAndConditionGroupChangeIds(
    changes,
    CPQ_QUOTE_TERM,
    CPQ_CONDITIONS_MET,
    CPQ_TERM_CONDITION,
    CPQ_QUOTE_TERM,
  )

export const getChangeGroupIds: ChangeGroupIdFunction = async changes => {
  const changeGroupIdMap = new Map<ChangeId, ChangeGroupId>()
  const customApprovalRuleAndConditionChangeIds = getAddSbaaCustomApprovalRuleAndConditionGroupChangeIds(changes)
  const customPriceRuleAndConditionChangeIds = getAddCpqCustomPriceRuleAndConditionGroupChangeIds(changes)
  const customProductRuleAndConditionChangeIds = getAddCpqCustomProductRuleAndConditionGroupChangeIds(changes)
  const customQuoteTermsAndConditionsChangeIds = getAddCpqCustomQuoteTermsAndConditionsGroupChangeIds(changes)
  wu(changes.entries()).forEach(([changeId, change]) => {
    let groupId: string
    if (customApprovalRuleAndConditionChangeIds.has(changeId)) {
      groupId = ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP
    } else if (customPriceRuleAndConditionChangeIds.has(changeId)) {
      groupId = ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP
    } else if (customProductRuleAndConditionChangeIds.has(changeId)) {
      groupId = ADD_CPQ_CUSTOM_PRODUCT_RULE_AND_CONDITION_GROUP
    } else if (customQuoteTermsAndConditionsChangeIds.has(changeId)) {
      groupId = ADD_CPQ_QUOTE_TERM_AND_CONDITION_GROUP
    } else {
      groupId = getGroupId(change)
    }
    changeGroupIdMap.set(changeId, groupId)
  })

  return { changeGroupIdMap }
}
