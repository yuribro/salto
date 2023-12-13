/*
*                      Copyright 2024 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import axios from 'axios'
import Joi from 'joi'
import path from 'path'
import origGlob from 'glob'
import { promisify } from 'util'
import { Readable } from 'stream'
import { GetObjectCommandInput, PutObjectCommandInput } from '@aws-sdk/client-s3'

import { createS3Client, PartialS3Client } from '@salto-io/aws-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { readTextFile, rm, rename, replaceContents } from '@salto-io/file'
import { inspectValue, safeJsonStringify, createSchemeGuard } from '@salto-io/adapter-utils'
import { client } from '@salto-io/adapter-components'
import { state, ProviderOptionsS3, ProviderOptionsAuth0 } from '@salto-io/workspace'

import { StateContentProvider, getHashFromHashes } from './common'
import { buildS3DirectoryStore } from '../../s3_dir_store'

const { awu } = collections.asynciterable
const glob = promisify(origGlob)

const log = logger(module)

export type LocalStateFileContent = {
  account: string
  contentHash: string
}
const isLocalStateFileContent = createSchemeGuard<LocalStateFileContent>(
  Joi.object({
    account: Joi.string().required(),
    contentHash: Joi.string().required(),
  })
)

const parseLocalStateFile = async (filePath: string): Promise<LocalStateFileContent> => {
  const content = await readTextFile(filePath)
  const parsedContent = JSON.parse(content)
  if (!isLocalStateFileContent(parsedContent)) {
    throw new Error('Invalid local state file content')
  }
  return parsedContent
}

const buildLocalStateFileName = (prefix: string, account: string): string => (
  `${prefix}.${account}.json`
)

const findLocalStateFiles = (prefix: string): Promise<string[]> => (
  glob(buildLocalStateFileName(prefix, '*([!.])'))
)

const getAuth0Token = async (refreshToken: string, options: ProviderOptionsAuth0): Promise<string> => {
  const url = `https://${options.domain}/oauth/token`
  const resp = await axios.post(url, {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    data: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      grant_type: 'refresh_token',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      client_id: options.clientId,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      refresh_token: refreshToken,
      scope: 'email openid profile',
    }).catch(e => {
      log.error('Failed connecting to auth0: %s', e.message)
      throw new Error('Failed authenticating to presigner')
    })

  const authToken = resp.data?.access_token
  if (authToken === undefined) {
    log.debug('Got unexpected response from auth0: %o', resp)
    throw new Error('Failed authenticating to presigner')
  }
  return authToken
}

const createPresignerBasedS3Client = (
  presignerUrl: string, apiToken: string, authOptions: ProviderOptionsAuth0
): PartialS3Client => {
  const presignerClient = client.axiosConnection<
  { refreshToken: string; authOptions: ProviderOptionsAuth0; baseUrl: string }
  >({
    retryOptions: { retries: 1 },
    authParamsFunc: async ({ refreshToken, authOptions: options }) => {
      const authToken = await getAuth0Token(refreshToken, options)
      return { headers: { Authorization: `Bearer ${authToken}` } }
    },
    baseURLFunc: async ({ baseUrl }) => baseUrl,
    credValidateFunc: async () => ({ accountId: '' }),
    timeout: 3000,
  }).login({ refreshToken: apiToken, authOptions, baseUrl: presignerUrl })

  const getPresignedUrl = async (
    args: { Key: string | undefined; Bucket: string | undefined },
    method: 'getObject' | 'putObject',
  ): Promise<string> => {
    const awaitedClient = await presignerClient
    const response = await awaitedClient.post('', { key: args.Key, bucket: args.Bucket, method })
    const { url } = response.data
    if (url === undefined) {
      throw new Error(`Got unexpected response from presigner: ${response.data}`)
    }

    return url
  }

  return {
    getObject: async (args: GetObjectCommandInput) => {
      const url = await getPresignedUrl(args, 'getObject')
      const response = await axios.get(url, { responseType: 'stream' })
      return { Body: response.data, $metadata: { httpStatusCode: response.status } }
    },
    putObject: async (args: PutObjectCommandInput) => {
      const url = await getPresignedUrl(args, 'putObject')
      const response = await axios.put(url, args.Body, {
        headers: { 'Content-Type': 'application/octet-stream' },
      })
      return { $metadata: { httpStatusCode: response.status } }
    },
    listObjectsV2: async () => Promise.resolve({ Contents: [], $metadata: {} }),
  }
}

type CreateS3StateContentProviderArgs = {
  workspaceId: string
  options: ProviderOptionsS3
  authOptions?: ProviderOptionsAuth0
}
export const createS3StateContentProvider = (
  { workspaceId, options, authOptions }: CreateS3StateContentProviderArgs
): StateContentProvider => {
  const { bucket, prefix, uploadConcurrencyLimit } = options
  const remoteBasePath = prefix === undefined ? `state/${workspaceId}` : `${prefix}/state/${workspaceId}`

  const buildRemoteStateFileName = ({ account, contentHash }: LocalStateFileContent): string => (
    `${remoteBasePath}/${account}/${contentHash}`
  )

  const presignerToken = process.env.SALTO_STATE_PRESIGNER_TOKEN
  const s3 = options.presignerUrl && authOptions && presignerToken
    ? createPresignerBasedS3Client(options.presignerUrl, presignerToken, authOptions)
    : createS3Client()
  return {
    findStateFiles: findLocalStateFiles,
    clear: async localPrefix => {
      // We do not clear the current state file content from S3 on purpose as we expect that historic states
      // could be useful, and if not, that a lifecycle can be setup on S3 to remove them
      // This is to keep in line with the fact that we do not delete the previous state file on every writeContents
      const localFiles = await findLocalStateFiles(localPrefix)
      await Promise.all(localFiles.map(filename => rm(filename)))
    },
    rename: async (oldPrefix, newPrefix) => {
      // Rename has no effect on the remote files, we just need to move the local files
      const stateFiles = await findLocalStateFiles(oldPrefix)
      await awu(stateFiles).forEach(async filename => {
        const newFilePath = filename.replace(oldPrefix, path.join(path.dirname(oldPrefix), newPrefix))
        await rename(filename, newFilePath)
      })
    },
    getHash: async filePaths => {
      const allHashes = await awu(filePaths).map(parseLocalStateFile).map(parsed => parsed.contentHash).toArray()
      return getHashFromHashes(allHashes)
    },
    readContents: filePaths => (
      awu(filePaths)
        .map(async filePath => {
          const parsedFile = await parseLocalStateFile(filePath)
          const remoteStatePath = buildRemoteStateFileName(parsedFile)
          log.debug('Creating state content read stream from %s/%s', bucket, remoteStatePath)
          const readRes = await s3.getObject({ Bucket: bucket, Key: remoteStatePath })
          const stream = readRes.Body
          if (!(stream instanceof Readable)) {
            // Should never happen
            throw new Error(`Failed to read content of remote state ${remoteStatePath}: ${inspectValue(readRes)}`)
          }
          return { name: filePath, stream }
        })
    ),
    writeContents: async (localPrefix, contents) => {
      // Upload content to S3
      await Promise.all(contents.map(async ({ account, content, contentHash }) => {
        const remoteStatePath = buildRemoteStateFileName({ account, contentHash })
        log.debug('Uploading state content to %s/%s', bucket, remoteStatePath)
        await s3.putObject({ Bucket: bucket, Key: remoteStatePath, Body: content })
      }))
      // Update local files to point to new hash values
      await Promise.all(contents.map(async ({ account, contentHash }) => {
        await replaceContents(
          buildLocalStateFileName(localPrefix, account),
          safeJsonStringify({ account, contentHash } as LocalStateFileContent)
        )
      }))
    },
    staticFilesSource: state.buildHistoryStateStaticFilesSource(
      buildS3DirectoryStore({
        bucketName: bucket,
        baseDir: `${prefix}/${workspaceId}`,
        S3Client: s3,
        concurrencyLimit: uploadConcurrencyLimit,
      })
    ),
  }
}
