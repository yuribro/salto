/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  InstanceElement,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  toChange,
  getChangeData,
  isInstanceElement,
  StaticFile,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { createFilterCreatorParams } from '../../utils'
import ZendeskClient from '../../../src/client/client'
import {
  ARTICLE_ATTACHMENT_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  BRAND_TYPE_NAME,
  USER_SEGMENT_TYPE_NAME,
  ZENDESK,
} from '../../../src/constants'
import filterCreator from '../../../src/filters/article/article'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../../src/config'
import { createEveryoneUserSegmentInstance } from '../../../src/filters/everyone_user_segment'
import * as articleUtils from '../../../src/filters/article/utils'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})

describe('article filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'deploy' | 'onDeploy'>
  let filter: FilterType
  let mockGet: jest.SpyInstance
  let mockPost: jest.SpyInstance
  let mockPut: jest.SpyInstance
  let mockDelete: jest.SpyInstance

  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
  })
  const brandInstance = new InstanceElement('brandName', brandType, {
    id: 121255,
    subdomain: 'igonre',
  })
  const userSegmentInstance = new InstanceElement(
    'notEveryone',
    new ObjectType({ elemID: new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME) }),
    {
      user_type: 'notEveryone',
      built_in: true,
      name: 'notEveryone',
    },
  )
  const articleInstance = new InstanceElement(
    'testArticle',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
    {
      id: 1111,
      author_id: 'author@salto.io',
      comments_disabled: false,
      draft: false,
      promoted: false,
      position: 0,
      section_id: '12345',
      source_locale: 'en-us',
      locale: 'en-us',
      outdated: false,
      permission_group_id: '666',
      brand: brandInstance.value.id,
    },
  )
  const anotherArticleInstance = new InstanceElement(
    'userSegmentArticle',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
    {
      id: 2222,
      author_id: 'author@salto.io',
      comments_disabled: false,
      draft: false,
      promoted: false,
      position: 0,
      section_id: '12345',
      source_locale: 'en-us',
      locale: 'en-us',
      outdated: false,
      permission_group_id: '666',
      brand: brandInstance.value.id,
      user_segment_id: new ReferenceExpression(userSegmentInstance.elemID, userSegmentInstance),
    },
  )
  const articleWithAttachmentInstance = new InstanceElement(
    'articleWithAttachment',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
    {
      id: 333333,
      author_id: 'author@salto.io',
      comments_disabled: false,
      draft: false,
      promoted: false,
      position: 0,
      section_id: '12345',
      source_locale: 'en-us',
      locale: 'en-us',
      outdated: false,
      permission_group_id: '666',
      brand: brandInstance.value.id,
      title: 'title',
      body: '<p><img src=\\"https://salto87.zendesk.com/hc/article_attachments/123\\" alt=\\"nacl.png\\"></p>',
    },
  )
  const attachmentType = new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_ATTACHMENT_TYPE_NAME) })
  const content = Buffer.from('test')
  const notInlineArticleAttachmentInstance = new InstanceElement(
    'title_12345__attachmentFileName_png_false@uuuvu',
    attachmentType,
    {
      id: 20222022,
      file_name: 'attachmentFileName.png',
      content_type: 'image/png',
      inline: false,
      brand: brandInstance.value.id,
      content_url: 'https://someURL.com',
      relative_path: '/hc/article_attachments/20222022',
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [
        new ReferenceExpression(articleWithAttachmentInstance.elemID, articleWithAttachmentInstance),
      ],
    },
  )
  const inlineArticleAttachmentInstance = new InstanceElement(
    'title_12345__attachmentFileName_png_true@uuuvu',
    attachmentType,
    {
      id: 123,
      file_name: 'attachmentFileName.png',
      content_type: 'image/png',
      inline: true,
      brand: brandInstance.value.id,
      content_url: 'https://someURL.com',
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [
        new ReferenceExpression(articleWithAttachmentInstance.elemID, articleWithAttachmentInstance),
      ],
    },
  )
  const otherTranslationInlineArticleAttachmentInstance = new InstanceElement(
    'title_12345__otherTranslaitonAttachmentFileName_png_true@uuuvu',
    attachmentType,
    {
      id: 133,
      file_name: 'attachmentFileName.png',
      content_type: 'image/png',
      inline: true,
      brand: brandInstance.value.id,
      content_url: 'https://someURL.com',
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [
        new ReferenceExpression(articleWithAttachmentInstance.elemID, articleWithAttachmentInstance),
      ],
    },
  )
  const deletedInlineArticleAttachmentInstance = new InstanceElement(
    'title_12345__attachmentFileName2_png_true@uuuvu',
    attachmentType,
    {
      id: 124,
      file_name: 'attachmentFileName2.png',
      content_type: 'image/png',
      inline: true,
      brand: brandInstance.value.id,
      content_url: 'https://someURL.com',
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [
        new ReferenceExpression(articleWithAttachmentInstance.elemID, articleWithAttachmentInstance),
      ],
    },
  )
  articleWithAttachmentInstance.value.attachments = [
    new ReferenceExpression(deletedInlineArticleAttachmentInstance.elemID, deletedInlineArticleAttachmentInstance),
    new ReferenceExpression(notInlineArticleAttachmentInstance.elemID, notInlineArticleAttachmentInstance),
    new ReferenceExpression(inlineArticleAttachmentInstance.elemID, inlineArticleAttachmentInstance),
    new ReferenceExpression(
      otherTranslationInlineArticleAttachmentInstance.elemID,
      otherTranslationInlineArticleAttachmentInstance,
    ),
  ]
  const articleTranslationInstance = new InstanceElement(
    'testArticleTranslation',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'article_translation') }),
    {
      locale: { locale: 'en-us' },
      title: 'The title of the article',
      draft: false,
      brand: brandInstance.value.id,
      body: '<p>ppppp</p>',
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(articleInstance.elemID, articleInstance)] },
  )
  articleInstance.value.translations = [
    new ReferenceExpression(articleTranslationInstance.elemID, articleTranslationInstance),
  ]
  const translationWithAttachmentInstance = new InstanceElement(
    'translationWithAttachment',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'article_translation') }),
    {
      locale: { id: 'en-us' },
      title: 'This translation has attachment',
      body: '<p><img src=\\"https://salto87.zendesk.com/hc/article_attachments/123\\" alt=\\"nacl.png\\"></p>',
      draft: false,
      brand: brandInstance.value.id,
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [
        new ReferenceExpression(articleWithAttachmentInstance.elemID, articleWithAttachmentInstance),
      ],
    },
  )
  const otherTranslationWithAttachmentInstance = new InstanceElement(
    'otherTranslationWithAttachment',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'article_translation') }),
    {
      locale: { id: 'other' },
      title: 'This translation has attachment',
      body: '<p><img src=\\"https://salto87.zendesk.com/hc/article_attachments/133\\" alt=\\"nacl.png\\"></p>',
      draft: false,
      brand: brandInstance.value.id,
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [
        new ReferenceExpression(articleWithAttachmentInstance.elemID, articleWithAttachmentInstance),
      ],
    },
  )
  articleWithAttachmentInstance.value.translations = [
    new ReferenceExpression(translationWithAttachmentInstance.elemID, translationWithAttachmentInstance),
    new ReferenceExpression(otherTranslationWithAttachmentInstance.elemID, otherTranslationWithAttachmentInstance),
  ]
  const userSegmentType = new ObjectType({ elemID: new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME) })
  const everyoneUserSegmentInstance = createEveryoneUserSegmentInstance(userSegmentType)

  const generateElements = (): (InstanceElement | ObjectType)[] =>
    [articleInstance, anotherArticleInstance, userSegmentInstance, userSegmentType, everyoneUserSegmentInstance].map(
      element => element.clone(),
    )

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    const elementSource = buildElementsSourceFromElements([
      userSegmentType,
      everyoneUserSegmentInstance,
      notInlineArticleAttachmentInstance,
    ])
    const brandIdToClient = { [brandInstance.value.id]: client }
    filter = filterCreator(
      createFilterCreatorParams({
        client,
        elementSource,
        brandIdToClient,
        config: {
          ...DEFAULT_CONFIG,
          [FETCH_CONFIG]: {
            include: [
              {
                type: '.*',
              },
            ],
            exclude: [],
            guide: {
              brands: ['.*'],
            },
          },
        },
      }),
    ) as FilterType
  })

  describe('onFetch', () => {
    let elements: (InstanceElement | ObjectType)[]

    beforeEach(() => {
      elements = generateElements()
      mockGet = jest.spyOn(client, 'get')
      mockGet.mockImplementation(params => {
        if (['/api/v2/help_center/articles/333333/attachments'].includes(params.url)) {
          return {
            status: 200,
            data: {
              article_attachments: [
                {
                  id: notInlineArticleAttachmentInstance.value.id,
                  file_name: notInlineArticleAttachmentInstance.value.filename,
                  content_type: notInlineArticleAttachmentInstance.value.contentType,
                  inline: notInlineArticleAttachmentInstance.value.inline,
                  content_url: 'https://yo.com',
                },
              ],
            },
          }
        }
        if (
          ['/api/v2/help_center/articles/2222/attachments', '/api/v2/help_center/articles/1111/attachments'].includes(
            params.url,
          )
        ) {
          return { status: 200, data: { article_attachments: [] } }
        }
        if (params.url === '/hc/article_attachments/20222022') {
          return {
            status: 200,
            data: content,
          }
        }
        if (params.url === '/hc/article_attachments/123' || params.url === '/hc/article_attachments/133') {
          return {
            status: 200,
            data: content,
          }
        }
        throw new Error('Err')
      })
    })

    it('should add Everyone user_segment_id field', async () => {
      await filter.onFetch(elements)
      const fetchedArticle = elements.filter(isInstanceElement).find(i => i.elemID.name === 'testArticle')
      expect(fetchedArticle?.value).toEqual({
        ...articleInstance.value,
        user_segment_id: new ReferenceExpression(everyoneUserSegmentInstance.elemID, everyoneUserSegmentInstance),
      })
    })
    it('should not edit existing user_segment', async () => {
      await filter.onFetch(elements)
      const fetchedArticle = elements.filter(isInstanceElement).find(i => i.elemID.name === 'userSegmentArticle')
      expect(fetchedArticle?.value).toEqual(anotherArticleInstance.value)
    })
    it('should create article_attachment instance', async () => {
      const clonedElements = [
        articleWithAttachmentInstance,
        translationWithAttachmentInstance,
        otherTranslationWithAttachmentInstance,
        attachmentType,
        inlineArticleAttachmentInstance,
        otherTranslationInlineArticleAttachmentInstance,
        deletedInlineArticleAttachmentInstance,
        notInlineArticleAttachmentInstance,
      ].map(e => e.clone())
      await filter.onFetch(clonedElements)
      // deleted article shoule be removed
      expect(clonedElements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.article.instance.articleWithAttachment',
        'zendesk.article_attachment',
        'zendesk.article_attachment.instance.title_12345__attachmentFileName_png_false@uuuvu',
        'zendesk.article_attachment.instance.title_12345__attachmentFileName_png_true@uuuvu',
        'zendesk.article_attachment.instance.title_12345__otherTranslaitonAttachmentFileName_png_true@uuuvu',
        'zendesk.article_translation.instance.otherTranslationWithAttachment',
        'zendesk.article_translation.instance.translationWithAttachment',
      ])
      const fetchedAttachment = clonedElements
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'title_12345__attachmentFileName_png_false@uuuvu')
      expect(fetchedAttachment?.value.content).toEqual(
        new StaticFile({
          filepath: 'zendesk/article_attachment/title/attachmentFileName.png',
          encoding: 'binary',
          content,
        }),
      )
      const article = clonedElements.filter(isInstanceElement).find(i => i.elemID.typeName === ARTICLE_TYPE_NAME)
      expect(article?.value.attachments.map((e: ReferenceExpression) => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.article_attachment.instance.title_12345__attachmentFileName_png_false@uuuvu',
        'zendesk.article_attachment.instance.title_12345__attachmentFileName_png_true@uuuvu',
        'zendesk.article_attachment.instance.title_12345__otherTranslaitonAttachmentFileName_png_true@uuuvu',
      ])
    })
    it('should not create attachment content if article is missing, and return a fetch warning', async () => {
      const clonedAttachment = notInlineArticleAttachmentInstance.clone()
      const errors = await filter.onFetch([clonedAttachment, attachmentType])
      expect(errors).toMatchObject({
        errors: [
          {
            message: `could not add attachment ${clonedAttachment.elemID.getFullName()}, as could not find article for article_id ${clonedAttachment.value.article_id}`,
            severity: 'Warning',
            elemID: clonedAttachment.elemID,
          },
        ],
      })
      expect(clonedAttachment.value.content).toBeUndefined()
    })
    it('should not create attachment content if get content request fails, and return a fetch warning', async () => {
      const clonedAttachment = notInlineArticleAttachmentInstance.clone()
      mockGet.mockImplementation(() => {
        throw new Error('err')
      })
      const errors = await filter.onFetch([articleWithAttachmentInstance, clonedAttachment, attachmentType])
      expect(errors).toMatchObject({
        errors: [
          {
            message: `Failed to get attachment content for attachment ${clonedAttachment.elemID.getFullName()}`,
            severity: 'Warning',
            elemID: clonedAttachment.elemID,
          },
        ],
      })
      expect(clonedAttachment.value.content).toBeUndefined()
    })
    it('should not create attachment content if received content buffer is invalid, and return a fetch warning', async () => {
      const clonedAttachment = notInlineArticleAttachmentInstance.clone()
      mockGet.mockImplementation(() => ({ status: 200, data: 123 }))
      const errors = await filter.onFetch([articleWithAttachmentInstance, clonedAttachment, attachmentType])
      expect(errors).toMatchObject({
        errors: [
          {
            message: `Received invalid content response from Zendesk API for attachment ${clonedAttachment.elemID.getFullName()}`,
            severity: 'Warning',
            elemID: clonedAttachment.elemID,
          },
        ],
      })
      expect(clonedAttachment.value.content).toBeUndefined()
    })
  })

  describe('preDeploy', () => {
    beforeEach(() => {
      mockPost = jest.spyOn(client, 'post')
      mockPost.mockImplementation(params => {
        if (['/api/v2/help_center/articles/333333/bulk_attachments'].includes(params.url)) {
          return {
            status: 200,
          }
        }
        throw new Error('Err')
      })
      mockDelete = jest.spyOn(client, 'delete')
      mockDelete.mockImplementation(params => {
        if (['/api/v2/help_center/articles/attachments/20222022'].includes(params.url)) {
          return {
            status: 204,
          }
        }
        throw new Error('Err')
      })
    })
    it('should add the title and the body to the article instance from its translation', async () => {
      const clonedArticle = articleInstance.clone()
      const clonedTranslation = articleTranslationInstance.clone()
      const articleAddition = toChange({ after: clonedArticle })
      const TranslationAddition = toChange({ after: clonedTranslation })

      expect(clonedArticle.value.title).toBeUndefined()
      expect(clonedArticle.value.body).toBeUndefined()
      await filter.preDeploy([articleAddition, TranslationAddition])
      const filteredArticle = getChangeData(articleAddition)
      expect(filteredArticle.value.title).toBe('The title of the article')
      expect(filteredArticle.value.body).toBe('')
      expect(getChangeData(TranslationAddition)).toBe(clonedTranslation)
    })
    it('should run the creation of unassociated attachment', async () => {
      const mockAttachmentCreation = jest
        .spyOn(articleUtils, 'createUnassociatedAttachment')
        .mockImplementation(jest.fn())
      const clonedArticle = articleWithAttachmentInstance.clone()
      const clonedAttachment = notInlineArticleAttachmentInstance.clone()
      await filter.preDeploy([
        { action: 'add', data: { after: clonedArticle } },
        { action: 'add', data: { after: clonedAttachment } },
      ])
      expect(mockAttachmentCreation).toHaveBeenCalledTimes(1)
      expect(mockAttachmentCreation).toHaveBeenCalledWith(client, clonedAttachment)
    })
    it('should create and associate modified attachments', async () => {
      const mockAttachmentCreation = jest
        .spyOn(articleUtils, 'createUnassociatedAttachment')
        .mockImplementation(jest.fn())
      const clonedArticle = articleWithAttachmentInstance.clone()
      const beforeClonedAttachment = notInlineArticleAttachmentInstance.clone()
      const afterClonedAttachment = notInlineArticleAttachmentInstance.clone()
      afterClonedAttachment.value.content = new StaticFile({
        filepath: 'zendesk/article_attachment/title/modified.png',
        encoding: 'binary',
        content: Buffer.from('modified'),
      })
      clonedArticle.value.attachments = [new ReferenceExpression(afterClonedAttachment.elemID, afterClonedAttachment)]
      await filter.preDeploy([
        { action: 'modify', data: { before: beforeClonedAttachment, after: afterClonedAttachment } },
      ])

      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(mockAttachmentCreation).toHaveBeenCalledTimes(1)
      expect(mockAttachmentCreation).toHaveBeenCalledWith(client, afterClonedAttachment)
    })
    it('should delete new attachment in case associate fails', async () => {
      const mockAttachmentDeletion = jest.spyOn(articleUtils, 'deleteArticleAttachment').mockImplementation(jest.fn())
      mockPost.mockReturnValueOnce({ status: 400 })
      const clonedArticle = articleWithAttachmentInstance.clone()
      const beforeClonedAttachment = notInlineArticleAttachmentInstance.clone()
      const afterClonedAttachment = notInlineArticleAttachmentInstance.clone()
      afterClonedAttachment.value.content = new StaticFile({
        filepath: 'zendesk/article_attachment/title/modified.png',
        encoding: 'binary',
        content: Buffer.from('modified'),
      })
      clonedArticle.value.attachments = [new ReferenceExpression(afterClonedAttachment.elemID, afterClonedAttachment)]
      await filter.preDeploy([
        { action: 'modify', data: { before: beforeClonedAttachment, after: afterClonedAttachment } },
      ])

      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(mockAttachmentDeletion).toHaveBeenCalledTimes(1)
      expect(mockAttachmentDeletion).toHaveBeenCalledWith(client, afterClonedAttachment)
    })
  })

  describe('deploy', () => {
    beforeEach(() => {
      mockPost = jest.spyOn(client, 'post')
      // For article_attachment UT
      mockPost.mockImplementation(params => {
        if (['/api/v2/help_center/articles/333333/bulk_attachments'].includes(params.url)) {
          return {
            status: 200,
          }
        }
        throw new Error('Err')
      })
      mockPut = jest.spyOn(client, 'put')
      mockPut.mockImplementation(params => {
        if (['/api/v2/help_center/articles/1111/source_locale'].includes(params.url)) {
          return {
            status: 200,
          }
        }
        throw new Error('Err')
      })
    })

    it('should pass the correct params to deployChange on create', async () => {
      const id = 2
      mockDeployChange.mockImplementation(async () => ({ workspace: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: articleInstance } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: articleInstance } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['translations', 'attachments'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: articleInstance } }])
    })

    it('should pass the correct params to deployChange on update', async () => {
      const id = 3333
      const clonedArticleBefore = articleInstance.clone()
      const clonedArticleAfter = articleInstance.clone()
      clonedArticleBefore.value.id = id
      clonedArticleAfter.value.id = id
      clonedArticleAfter.value.title = 'newTitle!'
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedArticleBefore, after: clonedArticleAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedArticleBefore, after: clonedArticleAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['translations', 'attachments', 'source_locale'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedArticleBefore, after: clonedArticleAfter },
        },
      ])
    })

    it('should pass the correct params to deployChange for user_segment_id', async () => {
      const id = 2
      mockDeployChange.mockImplementation(async () => ({ workspace: { id } }))
      const clonedArticle = articleInstance.clone()
      clonedArticle.value.user_segment_ids = [123]
      clonedArticle.value.user_segment_id = 123
      const res = await filter.deploy([{ action: 'add', data: { after: clonedArticle } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: clonedArticle } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['translations', 'attachments', 'user_segment_id'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: clonedArticle } }])
    })

    it('should pass the correct params to deployChange on remove', async () => {
      const id = 2
      const clonedArticle = articleInstance.clone()
      clonedArticle.value.id = id
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([{ action: 'remove', data: { before: clonedArticle } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    it('should return error if deployChange failed', async () => {
      mockDeployChange.mockImplementation(async () => {
        throw new Error('err')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: articleInstance } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: articleInstance } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['translations', 'attachments'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    it('should associate attachments to articles on creation', async () => {
      const mockAttachmentCreation = jest
        .spyOn(articleUtils, 'createUnassociatedAttachment')
        .mockImplementation(jest.fn())
      const clonedArticle = articleWithAttachmentInstance.clone()
      const clonedAttachment = notInlineArticleAttachmentInstance.clone()
      clonedArticle.value.attachments = [new ReferenceExpression(clonedAttachment.elemID, clonedAttachment)]
      const id = 2
      mockDeployChange.mockImplementation(async () => ({ workspace: { id } }))
      await filter.preDeploy([
        { action: 'add', data: { after: clonedArticle } },
        { action: 'add', data: { after: clonedAttachment } },
      ])
      expect(mockAttachmentCreation).toHaveBeenCalledTimes(1)
      const res = await filter.deploy([
        { action: 'add', data: { after: clonedArticle } },
        { action: 'add', data: { after: clonedAttachment } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(2)
      expect(res.deployResult.appliedChanges).toEqual([
        { action: 'add', data: { after: clonedArticle } },
        { action: 'add', data: { after: clonedAttachment } },
      ])
    })
    it('should send a separate request when updating default_locale', async () => {
      const clonedArticle = articleInstance.clone()
      clonedArticle.value.source_locale = 'ar'
      await filter.deploy([{ action: 'modify', data: { before: articleInstance, after: clonedArticle } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockPut).toHaveBeenCalledTimes(1)
    })

    it('should not associate attachments to articles if attachment was not modified', async () => {
      const clonedArticle = new InstanceElement(
        'articleWithAttachment',
        new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
        {
          id: 333333,
          author_id: 'author@salto.io',
          comments_disabled: false,
          draft: false,
          promoted: false,
          position: 0,
          section_id: '12345',
          source_locale: 'en-us',
          locale: 'en-us',
          outdated: false,
          permission_group_id: '666',
          brand: brandInstance.value.id,
          title: 'title',
          attachments: [
            {
              id: 20222022,
              filename: 'attachmentFileName.png',
              contentType: 'image/png',
              content: new StaticFile({
                filepath: 'zendesk/article_attachment/title/attachmentFileName.png',
                encoding: 'binary',
                content,
              }),
              inline: false,
              brand: brandInstance.value.id,
            },
          ],
        },
      )
      const id = 2
      mockDeployChange.mockImplementation(async () => ({ workspace: { id } }))
      const res = await filter.deploy([{ action: 'modify', data: { before: clonedArticle, after: clonedArticle } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        { action: 'modify', data: { before: clonedArticle, after: clonedArticle } },
      ])
    })
  })

  describe('onDeploy', () => {
    it('should omit the title and the body from the article instance', async () => {
      const clonedArticle = articleInstance.clone()
      const clonedTranslation = articleTranslationInstance.clone()
      const articleAddition = toChange({ after: clonedArticle })
      const TranslationAddition = toChange({ after: clonedTranslation })

      clonedArticle.value.title = 'title'
      clonedArticle.value.body = 'body'
      await filter.onDeploy([articleAddition, TranslationAddition])
      const filteredArticle = getChangeData(articleAddition)
      expect(filteredArticle.value.title).toBeUndefined()
      expect(filteredArticle.value.body).toBeUndefined()
      expect(getChangeData(TranslationAddition)).toBe(clonedTranslation)
    })
  })
  it('should have an empty user segment id when changing to Everyone', async () => {
    const clonedArticle = anotherArticleInstance.clone()
    // Changing user segment to "Everyone" completely removes the
    // field from the article instance
    delete clonedArticle.value.user_segment_id
    const articleModification = toChange({ before: anotherArticleInstance, after: clonedArticle })

    await filter.deploy([articleModification])
    const filteredArticle = getChangeData(articleModification)
    expect(filteredArticle.value.user_segment_id).toBeNull()
  })
})
