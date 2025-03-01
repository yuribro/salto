/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import * as vscode from 'vscode'
import { loadLocalWorkspace, closeAllRemoteMaps } from '@salto-io/core'
import { diagnostics, workspace as ws } from '@salto-io/lang-server'
import { adapterCreators } from '@salto-io/adapter-creators'
import { onTextChangeEvent, onFileChange, onFileOpen, createReportErrorsEventListener } from './events'
import {
  createCompletionsProvider,
  createDefinitionsProvider,
  createReferenceProvider,
  createDocumentSymbolsProvider,
  createWorkspaceSymbolProvider,
  createFoldingProvider,
} from './providers'
import { toVSDiagnostics } from './adapters'
import { createCopyReferenceCommand, createGoToServiceCommand } from './commands'
/**
 * This files act as a bridge between VSC and the @salto-io/core specific functionality.
 */

const onActivate = async (context: vscode.ExtensionContext): Promise<void> => {
  // eslint-disable-next-line no-console
  console.log('Workspace init started', new Date())
  const { name, rootPath } = vscode.workspace
  if (name && rootPath) {
    const diagCollection = vscode.languages.createDiagnosticCollection('@salto-io/core')
    const workspace = new ws.EditorWorkspace(
      rootPath,
      await loadLocalWorkspace({ path: rootPath, persistent: false, adapterCreators }),
    )

    const completionProvider = vscode.languages.registerCompletionItemProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.nacl' } },
      createCompletionsProvider(workspace),
      ' ',
      '.',
    )

    const definitionProvider = vscode.languages.registerDefinitionProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.nacl' } },
      createDefinitionsProvider(workspace),
    )

    const referenceProvider = vscode.languages.registerReferenceProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.nacl' } },
      createReferenceProvider(workspace),
    )

    const symbolsProvider = vscode.languages.registerDocumentSymbolProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.nacl' } },
      createDocumentSymbolsProvider(workspace),
    )

    const searchProvier = vscode.languages.registerWorkspaceSymbolProvider(createWorkspaceSymbolProvider(workspace))

    const foldProvider = vscode.languages.registerFoldingRangeProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.nacl' } },
      createFoldingProvider(workspace),
    )

    context.subscriptions.push(
      completionProvider,
      definitionProvider,
      referenceProvider,
      symbolsProvider,
      searchProvier,
      foldProvider,
      vscode.workspace.onDidChangeTextDocument(e => onTextChangeEvent(e, workspace)),
      vscode.workspace.onDidChangeTextDocument(createReportErrorsEventListener(workspace, diagCollection)),
      vscode.workspace.onDidOpenTextDocument(td => onFileOpen(workspace, td.fileName)),
      vscode.commands.registerCommand('salto.copyReference', createCopyReferenceCommand(workspace)),
      vscode.commands.registerCommand('salto.goToService', createGoToServiceCommand(workspace)),
    )
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.nacl')
    fileWatcher.onDidCreate((uri: vscode.Uri) => onFileChange(workspace, uri.fsPath))
    fileWatcher.onDidChange((uri: vscode.Uri) => onFileChange(workspace, uri.fsPath))
    fileWatcher.onDidDelete((uri: vscode.Uri) => onFileChange(workspace, uri.fsPath))
    const newDiag = toVSDiagnostics(workspace.baseDir, await diagnostics.getDiagnostics(workspace))
    diagCollection.set(newDiag)
  }
  // We need this log until the parse time will be shorter so we will know when to expect the plugin
  // to start working.
  // eslint-disable-next-line no-console
  console.log('Workspace init done', new Date())
}

export const activate = async (context: vscode.ExtensionContext): Promise<void> =>
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: 'Initiating salto extension',
    },
    async () => onActivate(context),
  )

export const deactivate = async (): Promise<void> => {
  await closeAllRemoteMaps()
}
