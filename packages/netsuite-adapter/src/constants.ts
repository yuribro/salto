/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export const NETSUITE = 'netsuite'
export const RECORDS_PATH = 'Records'
export const FILE_CABINET_PATH = 'FileCabinet'
export const TYPES_PATH = 'Types'
export const SUBTYPES_PATH = 'Subtypes'
export const FIELD_TYPES_PATH = 'fieldTypes'
export const SETTINGS_PATH = 'Settings'
export const CUSTOM_RECORDS_PATH = 'CustomRecords'

// Type names
export const ADDRESS_FORM = 'addressForm'
export const CRM_CUSTOM_FIELD = 'crmcustomfield'
export const CRM_CUSTOM_FIELD_PREFIX = 'custevent'
export const CUSTOM_LIST = 'customlist'
export const CUSTOM_RECORD_TYPE = 'customrecordtype'
export const CUSTOM_RECORD_TYPE_NAME_PREFIX = 'customrecord'
export const CUSTOM_RECORD_TYPE_PREFIX = 'customrecord_'
export const CUSTOM_SEGMENT = 'customsegment'
export const DATASET = 'dataset'
export const EMAIL_TEMPLATE = 'emailtemplate'
export const ENTITY_CUSTOM_FIELD = 'entitycustomfield'
export const ENTITY_CUSTOM_FIELD_PREFIX = 'custentity'
export const ENTRY_FORM = 'entryForm'
export const INTEGRATION = 'integration'
export const ITEM_CUSTOM_FIELD = 'itemcustomfield'
export const ITEM_CUSTOM_FIELD_PREFIX = 'custitem'
export const ROLE = 'role'
export const SAVED_SEARCH = 'savedsearch'
export const SAVED_CSV_IMPORT = 'savedcsvimport'
export const TRANSACTION_BODY_CUSTOM_FIELD = 'transactionbodycustomfield'
export const TRANSACTION_COLUMN_CUSTOM_FIELD = 'transactioncolumncustomfield'
export const TRANSACTION_FORM = 'transactionForm'
export const TRANSLATION_COLLECTION = 'translationcollection'
export const CENTER_CATEGORY = 'centercategory'
export const CENTER_TAB = 'centertab'
export const SUBTAB = 'subtab'
export const OTHER_CUSTOM_FIELD = 'othercustomfield'
export const OTHER_CUSTOM_FIELD_PREFIX = 'custrecord'
export const WORKBOOK = 'workbook'
export const WORKFLOW = 'workflow'
export const FILE = 'file'
export const FOLDER = 'folder'
export const SELECT_OPTION = 'selectOption'
export const CONFIG_FEATURES = 'companyFeatures'
export const CURRENCY = 'currency'
export const RECORD_REF = 'recordRef'
export const EMPLOYEE = 'employee'
export const REPORT_DEFINITION = 'reportdefinition'
export const FINANCIAL_LAYOUT = 'financiallayout'
export const BUNDLE = 'bundle'
export const BIN = 'bin'
export const TAX_SCHEDULE = 'taxSchedule'
export const PROJECT_EXPENSE_TYPE = 'projectExpenseType'
export const ALLOCATION_TYPE = 'allocationType'
export const SUPPORT_CASE_PROFILE = 'supportCaseProfile'
export const FIELD_TYPE = 'fieldType'

// Type Annotations
export const SOURCE = 'source'
export const METADATA_TYPE = 'metadataType'
export const IS_LOCKED = 'isLocked'

// Fields
export const SCRIPT_ID = 'scriptid'
export const SOAP_SCRIPT_ID = 'scriptId'
export const INTERNAL_ID = 'internalId'
export const ID_FIELD = 'id'
export const NAME_FIELD = 'name'
export const PATH = 'path'
export const PERMITTED_ROLE = 'permittedrole'
export const RECORD_TYPE = 'recordType'
export const APPLICATION_ID = 'application_id'
export const PARENT = 'parent'
export const CUSTOM_FIELD_PREFIX = 'custom_'
export const EXCHANGE_RATE = 'exchangeRate'
export const PERMISSIONS = 'permissions'
export const PERMISSION = 'permission'
export const CUSTOM_FIELD = 'customField'
export const CUSTOM_FIELD_LIST = 'customFieldList'
export const CONTENT = 'content'
export const INIT_CONDITION = 'initcondition'
export const SELECT_RECORD_TYPE = 'selectrecordtype'
export const VALUE_FIELD = 'value'
export const ADDITIONAL_DEPENDENCIES = 'additionalDependencies'

type InactiveFields = 'isinactive' | 'inactive' | 'isInactive'
export const INACTIVE_FIELDS: { [K in InactiveFields]: K } = {
  isinactive: 'isinactive',
  inactive: 'inactive',
  isInactive: 'isInactive',
}

// Field Annotations
export const SOAP = 'soap'
export const IS_ATTRIBUTE = 'isAttribute'
export const ADDITIONAL_FILE_SUFFIX = 'additionalFileSuffix'
export const LIST_MAPPED_BY_FIELD = 'map_key_field'
export const INDEX = 'index'
export const REAL_VALUE_KEY = '#text'

// SDF FileCabinet top level folders
export const FILE_CABINET_PATH_SEPARATOR = '/'
export const SUITE_SCRIPTS_FOLDER_NAME = 'SuiteScripts'
export const TEMPLATES_FOLDER_NAME = 'Templates'
export const WEB_SITE_HOSTING_FILES_FOLDER_NAME = 'Web Site Hosting Files'

export const ACCOUNT_SPECIFIC_VALUE = '[ACCOUNT_SPECIFIC_VALUE]'
export const NOT_YET_SUPPORTED_VALUE = '[NOT_YET_SUPPORTED]'
