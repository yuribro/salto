/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  AdapterOperations,
  ElemIdGetter,
  AdapterOperationsContext,
  ElemID,
  InstanceElement,
  Adapter,
  AdapterAuthentication,
  Element,
  ReadOnlyElementsSource,
  GLOBAL_ADAPTER,
  ObjectType,
  isInstanceElement,
  isType,
  TypeElement,
  isObjectType,
} from '@salto-io/adapter-api'
import { createDefaultInstanceFromType, resolvePath, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import {
  createAdapterReplacedID,
  expressions,
  merger,
  updateElementsWithAlternativeAccount,
  elementSource as workspaceElementSource,
  getAdaptersConfigTypesMap as getAdaptersConfigTypesMapImplementation,
} from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
// for backward comptability
import { adapterCreators as allAdapterCreators } from '@salto-io/adapter-creators'

const { awu } = collections.asynciterable
const { buildContainerType } = workspaceElementSource
const log = logger(module)

type getAdaptersCredentialsTypesArgs = { names?: ReadonlyArray<string>; adapterCreators: Record<string, Adapter> }

const getGetAdaptersCredentialsTypes: (
  namesOrParams?: ReadonlyArray<string> | getAdaptersCredentialsTypesArgs,
) => getAdaptersCredentialsTypesArgs = namesOrParams => {
  if (namesOrParams && 'adapterCreators' in namesOrParams) {
    return namesOrParams
  }
  return {
    names: namesOrParams,
    adapterCreators: allAdapterCreators,
  }
}
// As a transitionary step, we support both a string array input and an argument object
export function getAdaptersCredentialsTypes(
  args: getAdaptersCredentialsTypesArgs,
): Record<string, AdapterAuthentication>
// @deprecated
export function getAdaptersCredentialsTypes(inputNames?: ReadonlyArray<string>): Record<string, AdapterAuthentication>

export function getAdaptersCredentialsTypes(
  inputNames?: ReadonlyArray<string> | getAdaptersCredentialsTypesArgs,
): Record<string, AdapterAuthentication> {
  // for backward compatibility
  const { names, adapterCreators } = getGetAdaptersCredentialsTypes(inputNames)
  let relevantAdapterCreators: Record<string, Adapter>
  if (names === undefined) {
    relevantAdapterCreators = adapterCreators
  } else {
    const nonExistingAdapters = names.filter(name => !Object.keys(adapterCreators).includes(name))
    if (!_.isEmpty(nonExistingAdapters)) {
      throw new Error(`No adapter available for ${nonExistingAdapters}`)
    }
    relevantAdapterCreators = _.pick(adapterCreators, names)
  }
  return _.mapValues(relevantAdapterCreators, creator => creator.authenticationMethods)
}

export const initAdapters = (
  config: Record<string, AdapterOperationsContext>,
  accountToServiceNameMap: Record<string, string> = {},
  adapterCreators?: Record<string, Adapter>,
): Record<string, AdapterOperations> =>
  _.mapValues(config, (context, account) => {
    // for backward compatibility
    const actualAdapterCreator = adapterCreators ?? allAdapterCreators
    if (!context.credentials) {
      throw new Error(`${account} is not logged in.\n\nPlease login and try again.`)
    }
    if (!accountToServiceNameMap[account]) {
      throw new Error(`${account} account does not exist in environment.`)
    }
    const creator = actualAdapterCreator[accountToServiceNameMap[account]]
    if (!creator) {
      throw new Error(`${accountToServiceNameMap[account]} adapter is not registered.`)
    }
    log.debug(
      'Using the following config for %s account: %s',
      account,
      safeJsonStringify(context.config?.value, undefined, 2),
    )
    return creator.operations(context)
  })

const getAdapterConfigFromType = async (
  adapterName: string,
  adapterCreators: Record<string, Adapter>,
): Promise<InstanceElement | undefined> => {
  const { configType } = adapterCreators[adapterName]
  return configType ? createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType) : undefined
}

export const getAdaptersConfigTypesMap = (adapterCreators?: Record<string, Adapter>): Record<string, ObjectType[]> => {
  // for backward compatibility
  const actualAdapterCreator = adapterCreators ?? allAdapterCreators
  return getAdaptersConfigTypesMapImplementation(actualAdapterCreator)
}
export const getAdaptersConfigTypes = async (adapterCreators?: Record<string, Adapter>): Promise<ObjectType[]> =>
  Object.values(getAdaptersConfigTypesMap(adapterCreators)).flat()

type GetDefaultAdapterConfigParams = {
  adapterName: string
  accountName?: string
  options?: InstanceElement
  adapterCreators: Record<string, Adapter>
}

const getGetDefaultAdapterConfigArgs: (
  adapterNameOrParams: string | GetDefaultAdapterConfigParams,
  accountName?: string,
  options?: InstanceElement,
) => GetDefaultAdapterConfigParams = (adapterNameOrParams, accountName, options) => {
  if (!_.isString(adapterNameOrParams)) {
    return adapterNameOrParams
  }
  return {
    adapterName: adapterNameOrParams,
    accountName,
    options,
    adapterCreators: allAdapterCreators,
  }
}

// As a transitionary step, we support both a string input and an argument object
export function getDefaultAdapterConfig(args: GetDefaultAdapterConfigParams): Promise<InstanceElement[] | undefined>
// @deprecated
export function getDefaultAdapterConfig(
  inputAdapterName: string | GetDefaultAdapterConfigParams,
  inputAccountName?: string,
  inputOptions?: InstanceElement,
): Promise<InstanceElement[] | undefined>

export async function getDefaultAdapterConfig(
  inputAdapterName: string | GetDefaultAdapterConfigParams,
  inputAccountName?: string,
  inputOptions?: InstanceElement,
): Promise<InstanceElement[] | undefined> {
  // for backward compatibility
  const { adapterName, accountName, options, adapterCreators } = getGetDefaultAdapterConfigArgs(
    inputAdapterName,
    inputAccountName,
    inputOptions,
  )
  const { getConfig } = adapterCreators[adapterName]?.configCreator ?? {}
  const defaultConf = [
    getConfig !== undefined
      ? await getConfig(options)
      : (await getAdapterConfigFromType(adapterName, adapterCreators)) ?? [],
  ].flat()
  if (defaultConf.length === 0) {
    return undefined
  }
  if (accountName && adapterName !== accountName) {
    return awu(defaultConf)
      .map(async conf => {
        const confClone = conf.clone()
        await updateElementsWithAlternativeAccount([confClone], accountName, adapterName)
        return confClone
      })
      .toArray()
  }
  return defaultConf
}

const getMergedDefaultAdapterConfig = async (
  adapter: string,
  accountName: string,
  adapterCreators: Record<string, Adapter>,
): Promise<InstanceElement | undefined> => {
  const defaultConfig = await getDefaultAdapterConfig({ adapterName: adapter, accountName, adapterCreators })
  return defaultConfig && merger.mergeSingleElement(defaultConfig)
}

export const createElemIDReplacedElementsSource = (
  elementsSource: ReadOnlyElementsSource,
  account: string,
  adapter: string,
): ReadOnlyElementsSource =>
  account === adapter
    ? elementsSource
    : {
        getAll: async () =>
          awu(await elementsSource.getAll()).map(async element => {
            const ret = element.clone()
            await updateElementsWithAlternativeAccount([ret], adapter, account, elementsSource)
            return ret
          }),
        get: async id => {
          const element = (await elementsSource.get(createAdapterReplacedID(id, account)))?.clone()
          if (element) {
            await updateElementsWithAlternativeAccount([element], adapter, account, elementsSource)
          }
          return element
        },
        list: async () => awu(await elementsSource.list()).map(id => createAdapterReplacedID(id, adapter)),
        has: async id => {
          const transformedId = createAdapterReplacedID(id, account)
          return elementsSource.has(transformedId)
        },
      }

const filterElementsSource = (elementsSource: ReadOnlyElementsSource, adapterName: string): ReadOnlyElementsSource => {
  const isRelevantID = (elemID: ElemID): boolean => elemID.adapter === adapterName || elemID.adapter === GLOBAL_ADAPTER
  return {
    getAll: async () => awu(await elementsSource.getAll()).filter(elem => isRelevantID(elem.elemID)),
    get: async id => (isRelevantID(id) ? elementsSource.get(id) : undefined),
    list: async () => awu(await elementsSource.list()).filter(isRelevantID),
    has: async id => (isRelevantID(id) ? elementsSource.has(id) : false),
  }
}

export const createResolvedTypesElementsSource = (elementsSource: ReadOnlyElementsSource): ReadOnlyElementsSource => {
  let resolvedTypesPromise: Promise<Map<string, TypeElement>> | undefined
  const resolveTypes = async (): Promise<Map<string, TypeElement>> => {
    const typeElements = await awu(await elementsSource.list())
      .filter(id => id.idType === 'type')
      .map(id => elementsSource.get(id))
      .toArray()
    // Resolve all the types together for better performance
    const resolved = await expressions.resolve(typeElements, elementsSource, {
      shouldResolveReferences: false,
    })
    return new Map(resolved.filter(isType).map(resolvedType => [resolvedType.elemID.getFullName(), resolvedType]))
  }

  const getResolved = async (id: ElemID): Promise<Element> => {
    if (resolvedTypesPromise === undefined) {
      resolvedTypesPromise = resolveTypes()
    }
    const resolvedTypes = await resolvedTypesPromise
    // Container types
    const containerInfo = id.getContainerPrefixAndInnerType()
    if (containerInfo !== undefined) {
      const resolvedInner = await getResolved(ElemID.fromFullName(containerInfo.innerTypeName))
      if (isType(resolvedInner)) {
        return buildContainerType(containerInfo.prefix, resolvedInner)
      }
    }
    const { parent } = id.createTopLevelParentID()
    const alreadyResolvedType = resolvedTypes.get(parent.getFullName())
    if (alreadyResolvedType !== undefined) {
      // resolvePath here to handle cases where the input ID was for a field or attribute inside the type
      return resolvePath(alreadyResolvedType, id)
    }
    const value = await elementsSource.get(id)
    // Instances
    if (isInstanceElement(value)) {
      const instance = value.clone()
      const resolvedType = resolvedTypes.get(instance.refType.elemID.getFullName())
      // The type of the Element must be resolved here, otherwise we have a bug
      if (resolvedType === undefined) {
        log.warn(
          'Expected type of Instance %s to be resolved. Type elemID: %s. Returning Instance with non fully resolved type.',
          instance.elemID.getFullName(),
          instance.refType.elemID.getFullName(),
        )
        return instance
      }
      if (!isObjectType(resolvedType)) {
        log.warn(
          'Expected type of Instance %s to be an Object type. Type elemID: %s. Returning Instance with non fully resolved type.',
        )
        return instance
      }
      // If the type of the Element is resolved, simply set the type on the instance
      instance.refType.type = resolvedType
      return instance
    }
    return value
  }
  return {
    get: getResolved,
    getAll: async () => awu(await elementsSource.list()).map(getResolved),
    list: () => elementsSource.list(),
    has: id => elementsSource.has(id),
  }
}

type AdapterConfigGetter = (adapter: string, defaultValue?: InstanceElement) => Promise<InstanceElement | undefined>

export const getAdaptersCreatorConfigs = async (
  accounts: ReadonlyArray<string>,
  credentials: Readonly<Record<string, InstanceElement>>,
  getConfig: AdapterConfigGetter,
  elementsSource: ReadOnlyElementsSource,
  accountToServiceName: Record<string, string>,
  elemIdGetters: Record<string, ElemIdGetter> = {},
  resolveTypes = false,
  adapterCreators?: Record<string, Adapter>,
): Promise<Record<string, AdapterOperationsContext>> => {
  // for backward compatibility
  const actualAdapterCreator = adapterCreators ?? allAdapterCreators
  return Object.fromEntries(
    await Promise.all(
      accounts.map(async account => {
        const defaultConfig = await getMergedDefaultAdapterConfig(
          accountToServiceName[account],
          account,
          actualAdapterCreator,
        )
        const adapterElementSource = createElemIDReplacedElementsSource(
          filterElementsSource(elementsSource, account),
          account,
          accountToServiceName[account],
        )
        // Currently the type resolving element source has an internal cache and therefore we must not
        // use it in deploy where the underlying element source (the one we get as input here) changes
        const elementsSourceForAdapter = resolveTypes
          ? createResolvedTypesElementsSource(adapterElementSource)
          : adapterElementSource
        return [
          account,
          {
            credentials: credentials[account],
            config: await getConfig(account, defaultConfig),
            elementsSource: elementsSourceForAdapter,
            getElemIdFunc: elemIdGetters[account],
            accountName: account,
          },
        ]
      }),
    ),
  )
}

export const getAdapters = async (
  adapters: ReadonlyArray<string>,
  credentials: Readonly<Record<string, InstanceElement>>,
  getConfig: AdapterConfigGetter,
  workspaceElementsSource: ReadOnlyElementsSource,
  accountToServiceName: Record<string, string>,
  elemIdGetters: Record<string, ElemIdGetter> = {},
  adapterCreators?: Record<string, Adapter>,
): Promise<Record<string, AdapterOperations>> => {
  // for backward compatibility
  const actualAdapterCreator = adapterCreators ?? allAdapterCreators
  return initAdapters(
    await getAdaptersCreatorConfigs(
      adapters,
      credentials,
      getConfig,
      workspaceElementsSource,
      accountToServiceName,
      elemIdGetters,
      undefined,
      actualAdapterCreator,
    ),
    accountToServiceName,
    actualAdapterCreator,
  )
}
