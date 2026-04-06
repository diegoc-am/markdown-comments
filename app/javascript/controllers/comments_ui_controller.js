import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "sourceUrlInput",
    "documentMeta",
    "documentPreview",
    "rawModeButton",
    "renderedModeButton",
    "errorBox",
    "repositoryGroups"
  ]

  static values = {
    indexUrl: String,
    createUrl: String,
    updateUrlTemplate: String,
    deleteUrlTemplate: String,
    currentUserId: Number
  }

  connect() {
    this.previewMode = "rendered"
    this.draggingLines = false
    this.dragStartLine = null
    this.dragCurrentLine = null
    this.pendingSelection = null
    this.composer = null
    this.selectedRepoName = null
    this.focusCommentId = null

    this.initializeFromQuery()
    this.applyModeButtonState()
    this.initializeMermaid()
    this.loadRepositoryGroups()

    if (this.currentSourceUrl || this.focusCommentId) {
      this.loadComments()
    } else {
      this.renderDocument(null)
    }
  }

  initializeFromQuery() {
    const params = new URLSearchParams(window.location.search)
    this.selectedRepoName = params.get("repo") || null
    this.currentSourceUrl = params.get("source_url") || ""
    this.focusCommentId = params.get("comment_id") || null

    if (this.currentSourceUrl) {
      this.sourceUrlInputTarget.value = this.currentSourceUrl
    }
  }

  async loadRepositoryGroups() {
    try {
      const response = await fetch("/api/v1/repositories", {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        this.repositoryGroupsTarget.innerHTML = `<p class="text-sm text-red-700">${this.escapeHtml(payload.error || "Unable to load repositories.")}</p>`
        return
      }

      this.renderRepositoryGroups(payload.groups || [])
    } catch (_error) {
      this.repositoryGroupsTarget.innerHTML = '<p class="text-sm text-red-700">Unable to load repositories.</p>'
    }
  }

  renderRepositoryGroups(groups) {
    this.lastRepositoryGroups = groups

    const html = groups
      .map((group) => {
        const entries = (group.repositories || [])
          .slice(0, 10)
          .map((repo) => {
            const badge = repo.private ? '<span class="rounded bg-slate-200 px-1 py-0.5 text-[10px] uppercase text-slate-600">private</span>' : ""
            const tags = (repo.tags || [])
              .map((tag) => `<span class="rounded bg-blue-100 px-1 py-0.5 text-[10px] uppercase text-blue-700">${this.escapeHtml(tag.replaceAll("_", " "))}</span>`)
              .join("")

            const files = (repo.files || [])
              .slice(0, 20)
              .map((file) => {
                const commentMeta = file.my_comments > 0 ? `${file.my_comments} yours` : `${file.total_comments} total`
                const commentIdAttr = file.latest_comment_id ? `data-comment-id="${file.latest_comment_id}"` : ""
                const fileLink = this.appPermalink({ repoName: repo.full_name, sourceUrl: file.source_url, commentId: file.latest_comment_id })

                return `
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      data-action="click->comments-ui#openRepositoryFile"
                      data-repo-name="${this.escapeHtml(repo.full_name)}"
                      data-source-url="${this.escapeHtml(file.source_url)}"
                      ${commentIdAttr}
                    >
                      ${this.escapeHtml(file.path)}
                    </button>
                    <span class="text-[11px] text-slate-500">${this.escapeHtml(commentMeta)}</span>
                    <a href="${fileLink}" class="text-[11px] text-slate-500 underline hover:text-slate-700">share</a>
                    <button type="button" class="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100" data-action="click->comments-ui#copyLinkFromButton" data-copy-url="${fileLink}">copy</button>
                  </div>
                `
              })
              .join("")

            const isOpen = this.selectedRepoName === repo.full_name ? "open" : ""

            return `
              <details class="rounded-md border border-slate-200 bg-white p-2" ${isOpen}>
                <summary class="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700" data-action="click->comments-ui#selectRepositoryGroup" data-repo-name="${this.escapeHtml(repo.full_name)}">
                  <span>${this.escapeHtml(repo.full_name)}</span>
                  ${badge}
                  ${tags}
                </summary>
                <div class="mt-2 space-y-2 pl-1">${files || '<p class="text-xs text-slate-500">No files available.</p>'}</div>
              </details>
            `
          })
          .join("")

        const empty = entries.length === 0 ? '<p class="text-xs text-slate-500">No repositories in this group.</p>' : `<div class="mt-2 flex flex-wrap gap-2">${entries}</div>`
        return `<section class="mb-3 last:mb-0"><h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">${this.escapeHtml(group.title)}</h3>${empty}</section>`
      })
      .join("")

    this.repositoryGroupsTarget.innerHTML = html || '<p class="text-sm text-slate-500">No repositories found.</p>'
  }

  selectRepositoryGroup(event) {
    const repoName = event.currentTarget.dataset.repoName
    if (!repoName) return

    this.selectedRepoName = repoName
    this.updateQueryParams({ repoName, sourceUrl: this.currentSourceUrl, commentId: this.focusCommentId })
  }

  copyCurrentContextLink() {
    const url = this.appPermalink({
      repoName: this.selectedRepoName || this.currentDocument?.repository_name,
      sourceUrl: this.currentSourceUrl,
      commentId: this.focusCommentId
    })

    this.copyText(url)
  }

  copyLinkFromButton(event) {
    const url = event.currentTarget.dataset.copyUrl
    if (!url) return

    this.copyText(url)
  }

  openRepositoryFile(event) {
    const repoName = event.currentTarget.dataset.repoName
    const sourceUrl = event.currentTarget.dataset.sourceUrl
    const commentId = event.currentTarget.dataset.commentId || null

    if (!sourceUrl) return

    this.selectedRepoName = repoName || this.selectedRepoName
    this.focusCommentId = commentId
    this.sourceUrlInputTarget.value = sourceUrl
    this.currentSourceUrl = sourceUrl
    this.updateQueryParams({ repoName: this.selectedRepoName, sourceUrl: this.currentSourceUrl, commentId: this.focusCommentId })
    this.loadComments()
  }

  async loadComments() {
    try {
      this.clearError()
      const sourceUrl = this.sourceUrlInputTarget.value.trim()

      if (!sourceUrl && this.focusCommentId) {
        await this.loadFromCommentId(this.focusCommentId)
        return
      }

      if (!sourceUrl) {
        this.currentSourceUrl = ""
        this.updateQueryParams({ repoName: this.selectedRepoName, sourceUrl: null, commentId: null })
        this.renderDocument(null)
        return
      }

      this.currentSourceUrl = sourceUrl
      this.updateQueryParams({ repoName: this.selectedRepoName, sourceUrl: this.currentSourceUrl, commentId: this.focusCommentId })

      const url = new URL(this.indexUrlValue, window.location.origin)
      url.searchParams.set("source_url", sourceUrl)

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        this.showError(payload.error || "Unable to load document comments.")
        this.renderDocument(null)
        return
      }

      this.currentDocument = payload.document || null
      this.comments = payload.comments || []
      this.selectedRepoName = this.currentDocument?.repository_name || this.selectedRepoName
      this.updateQueryParams({ repoName: this.selectedRepoName, sourceUrl: this.currentSourceUrl, commentId: this.focusCommentId })
      this.renderDocument(this.currentDocument)
      this.renderRepositoryGroups(this.lastRepositoryGroups || [])
      this.scrollToFocusedComment()
    } catch (_error) {
      this.showError("Unable to load comments.")
      this.renderDocument(null)
    }
  }

  async loadFromCommentId(commentId) {
    const response = await fetch(`/api/v1/comments/${commentId}`, {
      headers: { Accept: "application/json" },
      credentials: "same-origin"
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.comment?.source_url) {
      this.showError(payload.error || "Unable to locate shared comment.")
      return
    }

    this.focusCommentId = String(commentId)
    this.sourceUrlInputTarget.value = payload.comment.source_url
    this.currentSourceUrl = payload.comment.source_url
    this.selectedRepoName = payload.comment.source_url.split("/").slice(3, 5).join("/") || this.selectedRepoName
    this.updateQueryParams({ repoName: this.selectedRepoName, sourceUrl: this.currentSourceUrl, commentId: this.focusCommentId })
    await this.loadComments()
  }

  showRawMode() {
    this.previewMode = "raw"
    this.applyModeButtonState()
    this.renderDocument(this.currentDocument)
  }

  showRenderedMode() {
    this.previewMode = "rendered"
    this.applyModeButtonState()
    this.renderDocument(this.currentDocument)
  }

  onDocumentMouseDown(event) {
    if (this.previewMode !== "raw") return

    const line = this.extractLineFromEvent(event)
    if (!line) return

    event.preventDefault()
    this.draggingLines = true
    this.dragStartLine = line
    this.dragCurrentLine = line
    this.setPendingRange(line, line)
  }

  onDocumentMouseOver(event) {
    if (!this.draggingLines || this.previewMode !== "raw") return

    const line = this.extractLineFromEvent(event)
    if (!line) return

    this.dragCurrentLine = line
    this.setPendingRange(this.dragStartLine, line)
  }

  onDocumentMouseUp(_event) {
    if (this.previewMode === "raw") {
      if (this.draggingLines && this.dragStartLine) {
        const end = this.dragCurrentLine || this.dragStartLine
        const start = this.dragStartLine
        this.pendingSelection = null
        this.draggingLines = false
        this.dragStartLine = null
        this.dragCurrentLine = null
        this.openComposerForRange(start, end)
        return
      }

      this.draggingLines = false
      this.dragStartLine = null
      this.dragCurrentLine = null
      return
    }

    if (this.previewMode !== "rendered") return
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return
    if (!this.documentPreviewTarget.contains(selection.anchorNode)) return

    const text = selection.toString().trim()
    if (!text) return

    const block = selection.anchorNode.parentElement?.closest("[data-block-start][data-block-end]")
    if (!block) return

    const start = parseInt(block.dataset.blockStart, 10)
    const finish = parseInt(block.dataset.blockEnd, 10)
    this.openComposerForRange(start, finish, `> ${text.replace(/\n/g, "\n> ")}\n\n`)
    selection.removeAllRanges()
  }

  onDocumentClick(event) {
    const commentButton = event.target.closest("button[data-command='new-comment']")
    if (commentButton) {
      const start = parseInt(commentButton.dataset.lineStart, 10)
      const finish = parseInt(commentButton.dataset.lineEnd, 10)
      this.openComposerForRange(start, finish)
      return
    }

    const actionButton = event.target.closest("button[data-command]")
    if (!actionButton) return

    const command = actionButton.dataset.command

    if (command === "editor-tab") {
      this.switchEditorTab(actionButton.dataset.editorId, actionButton.dataset.tab)
      return
    }

    if (command === "cancel-composer") {
      this.composer = null
      this.renderDocument(this.currentDocument)
      return
    }

    if (command === "copy-link") {
      const url = actionButton.dataset.copyUrl
      if (url) this.copyText(url)
      return
    }

    const commentId = actionButton.dataset.commentId
    if (!commentId) return

    if (command === "toggle-reply") {
      this.toggleReplyForm(commentId)
      return
    }

    if (command === "toggle-status") {
      this.updateCommentStatus(commentId, actionButton.dataset.nextStatus)
      return
    }

    if (command === "delete") {
      this.deleteComment(commentId)
    }
  }

  onEditorInput(event) {
    const textarea = event.target.closest("textarea[data-editor-input='true']")
    if (!textarea) return

    const container = this.documentPreviewTarget.querySelector(`[data-markdown-editor='${textarea.dataset.editorId}']`)
    if (!container) return

    const previewPanel = container.querySelector("[data-editor-panel='preview']")
    if (!previewPanel || previewPanel.classList.contains("hidden")) return

    this.updateEditorPreview(container)
  }

  async createComment(event) {
    event.preventDefault()
    const form = event.target
    const formData = new FormData(form)

    const payload = {
      comment: {
        source_url: this.currentSourceUrl,
        body: formData.get("body"),
        line_start: this.numberOrNull(formData.get("line_start")),
        line_end: this.numberOrNull(formData.get("line_end"))
      }
    }

    if (formData.get("parent_id")) {
      payload.comment.parent_id = parseInt(formData.get("parent_id"), 10)
    }

    try {
      const response = await fetch(this.createUrlValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-CSRF-Token": this.csrfToken()
        },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        this.showError(body.errors?.[0] || "Unable to save comment.")
        return
      }

      this.focusCommentId = body.comment?.id ? String(body.comment.id) : this.focusCommentId
      this.composer = null
      this.updateQueryParams({ repoName: this.selectedRepoName, sourceUrl: this.currentSourceUrl, commentId: this.focusCommentId })
      this.loadComments()
    } catch (_error) {
      this.showError("Unable to save comment.")
    }
  }

  async updateCommentStatus(commentId, status) {
    try {
      const response = await fetch(this.commentUrl(this.updateUrlTemplateValue, commentId), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-CSRF-Token": this.csrfToken()
        },
        credentials: "same-origin",
        body: JSON.stringify({ comment: { status } })
      })

      if (!response.ok) {
        this.showError("Unable to update comment status.")
        return
      }

      this.loadComments()
    } catch (_error) {
      this.showError("Unable to update comment status.")
    }
  }

  async deleteComment(commentId) {
    if (!window.confirm("Delete this comment and all replies?")) return

    try {
      const response = await fetch(this.commentUrl(this.deleteUrlTemplateValue, commentId), {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          "X-CSRF-Token": this.csrfToken()
        },
        credentials: "same-origin"
      })

      if (!response.ok) {
        this.showError("Unable to delete comment.")
        return
      }

      if (this.focusCommentId && String(commentId) === String(this.focusCommentId)) {
        this.focusCommentId = null
      }
      this.updateQueryParams({ repoName: this.selectedRepoName, sourceUrl: this.currentSourceUrl, commentId: this.focusCommentId })
      this.loadComments()
    } catch (_error) {
      this.showError("Unable to delete comment.")
    }
  }

  toggleReplyForm(commentId) {
    const form = this.documentPreviewTarget.querySelector(`form[data-reply-form][data-comment-id='${commentId}']`)
    if (!form) return

    form.classList.toggle("hidden")
    if (!form.classList.contains("hidden")) {
      const textarea = form.querySelector("textarea")
      if (textarea) textarea.focus()
    }
  }

  openComposerForRange(fromLine, toLine, body = "") {
    const start = Math.min(fromLine, toLine)
    const finish = Math.max(fromLine, toLine)
    this.pendingSelection = null
    this.composer = { start, finish, body }
    this.renderDocument(this.currentDocument)
  }

  setPendingRange(fromLine, toLine) {
    const start = Math.min(fromLine, toLine)
    const finish = Math.max(fromLine, toLine)
    this.pendingSelection = { start, finish }
    this.highlightSelectedRange()
  }

  renderDocument(document) {
    if (!document) {
      this.documentMetaTarget.innerHTML = ""
      this.documentPreviewTarget.innerHTML = '<div class="p-6 text-sm text-slate-500">Select a repository file from the list above to start reviewing comments.</div>'
      return
    }

    const shortSha = document.commit_sha ? document.commit_sha.slice(0, 12) : "unknown"
    this.documentMetaTarget.innerHTML = `<p><strong>${this.escapeHtml(document.repository_name || "Repository")}</strong> - ${this.escapeHtml(document.path)} - ref ${this.escapeHtml(document.repository_ref || "-")} - commit <code class="rounded bg-slate-100 px-1 py-0.5">${this.escapeHtml(shortSha)}</code></p>`

    const roots = this.buildRootThreads(this.comments || [])

    if (this.previewMode === "raw") {
      this.renderRawDocument(document.content || "", roots)
      return
    }

    this.renderRenderedDocument(document.content || "", roots)
  }

  renderRawDocument(content, roots) {
    const lines = content.split("\n")
    const rootByLine = this.groupRootsByLine(roots)
    const commentedLines = this.buildCommentedLineSet(roots)

    this.documentPreviewTarget.innerHTML = lines
      .map((line, index) => {
        const lineNumber = index + 1
        const blockComments = this.renderCommentThreads(rootByLine.get(lineNumber) || [])
        const composer = this.renderRawComposerForLine(lineNumber)
        const commentedClass = commentedLines.has(lineNumber) ? "bg-amber-50" : ""

        return `
          <div class="raw-block" data-line-block="${lineNumber}">
            <div class="line-row grid grid-cols-[56px_auto_1fr] gap-2 px-2 py-0.5 ${commentedClass}" data-line-row="${lineNumber}">
              <button type="button" class="text-right text-xs text-slate-500 hover:text-slate-900" data-line="${lineNumber}">${lineNumber}</button>
              <div class="line-controls flex items-start gap-1 transition-opacity duration-150">
                <button type="button" class="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100" data-command="new-comment" data-line-start="${lineNumber}" data-line-end="${lineNumber}">+</button>
                <a href="${this.linePermalink(lineNumber, lineNumber)}" class="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100" title="Copy line permalink">#</a>
              </div>
              <code class="whitespace-pre-wrap break-words py-1 text-xs sm:text-sm">${this.escapeHtml(line)}</code>
            </div>
            ${composer}
            ${blockComments}
          </div>
        `
      })
      .join("")

    this.highlightSelectedRange()
    this.enhanceMermaidBlocks()
    this.focusComposerIfPresent()
  }

  renderRawComposerForLine(lineNumber) {
    if (!this.composer) return ""
    if (this.composer.finish !== lineNumber) return ""

    return this.renderComposerIfMatch(this.composer.start, this.composer.finish)
  }

  renderRenderedDocument(content, roots) {
    const blocks = this.partitionMarkdownBlocks(content)
    const rootByLine = this.groupRootsByLine(roots)

    this.documentPreviewTarget.innerHTML = blocks
      .map((block) => {
        const html = this.renderMarkdownHtml(block.text)
        const comments = this.collectCommentsForRange(rootByLine, block.start, block.end)
        const threadHtml = this.renderCommentThreads(comments)
        const composer = this.renderComposerIfMatch(block.start, block.end)
        const highlightedClass = comments.length ? "bg-amber-50/60" : ""
        return `
          <div class="review-block border-b border-slate-200 p-4 ${highlightedClass}" data-block-start="${block.start}" data-block-end="${block.end}">
            <div class="mb-2 flex items-center gap-2 text-xs text-slate-500">
              <span>lines ${block.start}-${block.end}</span>
              <div class="block-controls flex items-center gap-1 transition-opacity duration-150">
                <button type="button" class="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100" data-command="new-comment" data-line-start="${block.start}" data-line-end="${block.end}">Comment</button>
                <a href="${this.linePermalink(block.start, block.end)}" class="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100" title="Copy block permalink">#</a>
              </div>
            </div>
            <div class="markdown-rendered">${html}</div>
            ${composer}
            ${threadHtml}
          </div>
        `
      })
      .join("")

    this.enhanceMermaidBlocks()
    this.focusComposerIfPresent()
  }

  renderCommentThreads(roots) {
    if (!roots.length) return ""
    return `<div class="space-y-3 bg-slate-50 px-3 py-3">${roots.map((node) => this.renderThreadNode(node)).join("")}</div>`
  }

  renderThreadNode(node, depth = 0) {
    const comment = node.comment
    const isOwner = Number(comment.user.id) === this.currentUserIdValue
    const nextStatus = comment.status === "resolved" ? "open" : "resolved"
    const statusText = comment.status === "resolved" ? "Reopen" : "Resolve"
    const statusClass = comment.status === "resolved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
    const replyEditorId = `reply-${comment.id}`
    const renderedBody = this.renderMarkdownHtml(comment.body || "")
    const isFocused = this.focusCommentId && String(comment.id) === String(this.focusCommentId)
    const commentPermalink = this.appPermalink({ repoName: this.currentDocument?.repository_name, sourceUrl: this.currentSourceUrl, commentId: comment.id })

    return `
      <article id="comment-${comment.id}" data-comment-id="${comment.id}" class="rounded-lg border ${isFocused ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"} bg-white p-3 ${depth > 0 ? "ml-4" : ""}">
        <div class="flex items-center justify-between gap-2">
          <strong class="text-sm text-slate-900">@${this.escapeHtml(comment.user.github_login)}</strong>
          <div class="flex items-center gap-2">
            <a href="${commentPermalink}" class="text-xs text-slate-500 underline hover:text-slate-700">link</a>
            <button type="button" class="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100" data-command="copy-link" data-copy-url="${commentPermalink}">copy</button>
            <span class="rounded-full px-2 py-0.5 text-xs ${statusClass}">${this.escapeHtml(comment.status)}</span>
          </div>
        </div>
        <div class="markdown-rendered mt-2 text-sm text-slate-800">${renderedBody}</div>
        <div class="mt-2 flex flex-wrap gap-2">
          <button type="button" class="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100" data-command="toggle-reply" data-comment-id="${comment.id}">Reply</button>
          <button type="button" class="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100" data-command="toggle-status" data-next-status="${nextStatus}" data-comment-id="${comment.id}">${statusText}</button>
          ${isOwner ? `<button type="button" class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50" data-command="delete" data-comment-id="${comment.id}">Delete</button>` : ""}
        </div>

        <form class="hidden mt-2 rounded border border-slate-200 bg-slate-50 p-2" data-reply-form data-comment-id="${comment.id}" data-action="submit->comments-ui#createComment">
          <input type="hidden" name="parent_id" value="${comment.id}">
          <input type="hidden" name="line_start" value="${comment.line_start || ""}">
          <input type="hidden" name="line_end" value="${comment.line_end || ""}">
          ${this.renderMarkdownEditor({ editorId: replyEditorId, submitLabel: "Post Reply" })}
        </form>

        ${node.children.map((child) => this.renderThreadNode(child, depth + 1)).join("")}
      </article>
    `
  }

  renderComposerIfMatch(start, finish) {
    if (!this.composer) return ""
    if (this.composer.start !== start || this.composer.finish !== finish) return ""

    return `
      <form class="rounded-lg border border-blue-200 bg-blue-50 p-3" data-action="submit->comments-ui#createComment">
        <div class="mb-2 text-xs font-medium text-blue-900">New comment on lines ${start}-${finish}</div>
        <input type="hidden" name="line_start" value="${start}">
        <input type="hidden" name="line_end" value="${finish}">
        ${this.renderMarkdownEditor({ editorId: `composer-${start}-${finish}`, body: this.composer.body || "", submitLabel: "Save Comment", textareaRows: 4, autofocus: true })}
        <div class="mt-2 flex gap-2">
          <button type="button" class="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100" data-command="cancel-composer">Cancel</button>
        </div>
      </form>
    `
  }

  focusComposerIfPresent() {
    const cancelButtons = this.documentPreviewTarget.querySelectorAll("button[data-command='cancel-composer']")
    cancelButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.composer = null
        this.renderDocument(this.currentDocument)
      }, { once: true })
    })

    const textarea = this.documentPreviewTarget.querySelector("textarea[data-editor-autofocus='true']")
    if (textarea) {
      textarea.focus()
      const container = this.documentPreviewTarget.querySelector(`[data-markdown-editor='${textarea.dataset.editorId}']`)
      if (container) this.updateEditorPreview(container)
    }
  }

  renderMarkdownEditor({ editorId, body = "", submitLabel = "Save", textareaRows = 3, autofocus = false }) {
    const escapedBody = this.escapeHtml(body)

    return `
      <div class="mt-2" data-markdown-editor="${editorId}">
        <div class="mb-2 inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs">
          <button type="button" class="rounded px-2 py-1 text-slate-700 bg-slate-900 text-white" data-command="editor-tab" data-editor-id="${editorId}" data-tab="raw">Raw</button>
          <button type="button" class="rounded px-2 py-1 text-slate-700" data-command="editor-tab" data-editor-id="${editorId}" data-tab="preview">Preview</button>
        </div>

        <div data-editor-panel="raw">
          <textarea name="body" rows="${textareaRows}" required class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none" data-editor-input="true" data-editor-id="${editorId}" ${autofocus ? "data-editor-autofocus='true'" : ""}>${escapedBody}</textarea>
        </div>

        <div class="hidden rounded border border-slate-200 bg-white p-3" data-editor-panel="preview" data-editor-preview></div>

        <button type="submit" class="mt-2 rounded bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-700">${submitLabel}</button>
      </div>
    `
  }

  switchEditorTab(editorId, tab) {
    if (!editorId || !tab) return

    const container = this.documentPreviewTarget.querySelector(`[data-markdown-editor='${editorId}']`)
    if (!container) return

    const rawPanel = container.querySelector("[data-editor-panel='raw']")
    const previewPanel = container.querySelector("[data-editor-panel='preview']")
    const buttons = container.querySelectorAll("button[data-command='editor-tab']")

    buttons.forEach((button) => {
      const active = button.dataset.tab === tab
      button.classList.toggle("bg-slate-900", active)
      button.classList.toggle("text-white", active)
    })

    if (tab === "preview") {
      if (rawPanel) rawPanel.classList.add("hidden")
      if (previewPanel) previewPanel.classList.remove("hidden")
      this.updateEditorPreview(container)
      return
    }

    if (rawPanel) rawPanel.classList.remove("hidden")
    if (previewPanel) previewPanel.classList.add("hidden")
  }

  updateEditorPreview(container) {
    const textarea = container.querySelector("textarea[data-editor-input='true']")
    const preview = container.querySelector("[data-editor-preview]")
    if (!textarea || !preview) return

    preview.innerHTML = `<div class="markdown-rendered text-sm">${this.renderMarkdownHtml(textarea.value || "")}</div>`
    this.enhanceMermaidInNode(preview)
  }

  partitionMarkdownBlocks(content) {
    const lines = content.split("\n")
    const blocks = []
    let start = 1
    let index = 0

    while (index < lines.length) {
      while (index < lines.length && lines[index].trim() === "") {
        index += 1
        start = index + 1
      }
      if (index >= lines.length) break

      const blockStart = index + 1
      let blockEnd = blockStart

      if (lines[index].trim().startsWith("```")) {
        index += 1
        while (index < lines.length) {
          blockEnd = index + 1
          if (lines[index].trim().startsWith("```")) {
            index += 1
            break
          }
          index += 1
        }
      } else {
        index += 1
        while (index < lines.length && lines[index].trim() !== "") {
          blockEnd = index + 1
          index += 1
        }
      }

      blocks.push({
        start: blockStart,
        end: Math.max(blockEnd, blockStart),
        text: lines.slice(blockStart - 1, Math.max(blockEnd, blockStart)).join("\n")
      })

      start = index + 1
    }

    return blocks.length ? blocks : [{ start: 1, end: 1, text: "" }]
  }

  renderMarkdownHtml(markdown) {
    if (!window.marked || !window.DOMPurify) {
      return '<p class="text-sm text-red-700">Markdown renderer is unavailable.</p>'
    }

    const html = window.marked.parse(markdown, {
      gfm: true,
      breaks: false,
      mangle: false,
      headerIds: false
    })

    return window.DOMPurify.sanitize(html)
  }

  enhanceMermaidBlocks() {
    this.enhanceMermaidInNode(this.documentPreviewTarget)
  }

  enhanceMermaidInNode(node) {
    if (!node) return

    const codeBlocks = node.querySelectorAll("pre code.language-mermaid")
    codeBlocks.forEach((block) => {
      const pre = block.closest("pre")
      if (!pre) return

      const mermaid = document.createElement("div")
      mermaid.className = "mermaid"
      mermaid.textContent = block.textContent
      pre.replaceWith(mermaid)
    })

    if (window.mermaid) {
      try {
        window.mermaid.run({ nodes: node.querySelectorAll(".mermaid") })
      } catch (_error) {
      }
    }
  }

  applyModeButtonState() {
    this.rawModeButtonTarget.classList.toggle("bg-slate-900", this.previewMode === "raw")
    this.rawModeButtonTarget.classList.toggle("text-white", this.previewMode === "raw")
    this.renderedModeButtonTarget.classList.toggle("bg-slate-900", this.previewMode === "rendered")
    this.renderedModeButtonTarget.classList.toggle("text-white", this.previewMode === "rendered")
  }

  initializeMermaid() {
    if (!window.mermaid) return
    window.mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" })
  }

  buildRootThreads(comments) {
    const byId = new Map()
    const roots = []

    comments.forEach((comment) => {
      byId.set(comment.id, { comment, children: [] })
    })

    byId.forEach((node) => {
      if (!node.comment.parent_id) {
        roots.push(node)
      } else {
        const parent = byId.get(node.comment.parent_id)
        if (parent) parent.children.push(node)
      }
    })

    return roots.sort((a, b) => this.commentAnchorLine(a.comment) - this.commentAnchorLine(b.comment))
  }

  groupRootsByLine(roots) {
    const grouped = new Map()
    roots.forEach((node) => {
      const key = this.commentAnchorLine(node.comment)
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(node)
    })
    return grouped
  }

  buildCommentedLineSet(roots) {
    const lines = new Set()

    roots.forEach((node) => {
      const start = node.comment.line_start || 1
      const finish = node.comment.line_end || node.comment.line_start || 1
      const min = Math.min(start, finish)
      const max = Math.max(start, finish)

      for (let line = min; line <= max; line += 1) {
        lines.add(line)
      }
    })

    return lines
  }

  collectCommentsForRange(grouped, start, finish) {
    const results = []
    for (let line = start; line <= finish; line += 1) {
      const nodes = grouped.get(line) || []
      results.push(...nodes)
    }
    return results
  }

  highlightSelectedRange() {
    const range = this.pendingSelection || this.composer
    const min = range ? Math.min(range.start, range.finish) : null
    const max = range ? Math.max(range.start, range.finish) : null

    this.documentPreviewTarget.querySelectorAll("[data-line-row]").forEach((row) => {
      const line = parseInt(row.dataset.lineRow, 10)
      const selected = min !== null && max !== null && line >= min && line <= max
      row.classList.toggle("bg-blue-100", selected)
    })
  }

  extractLineFromEvent(event) {
    const buttonTarget = event.target.closest("button[data-line]")
    if (buttonTarget) {
      const line = parseInt(buttonTarget.dataset.line, 10)
      return Number.isNaN(line) ? null : line
    }

    const rowTarget = event.target.closest("[data-line-row]")
    if (!rowTarget) return null

    const line = parseInt(rowTarget.dataset.lineRow, 10)
    return Number.isNaN(line) ? null : line
  }

  commentAnchorLine(comment) {
    return comment.line_end || comment.line_start || 1
  }

  linePermalink(start, finish) {
    const source = this.currentDocument?.source_url || this.currentSourceUrl || ""
    if (!source) return "#"

    const lineRange = start === finish ? `${start}` : `${start}-${finish}`
    const url = new URL(window.location.href)
    url.searchParams.set("repo", this.currentDocument?.repository_name || this.selectedRepoName || "")
    url.searchParams.set("source_url", source)
    url.searchParams.delete("comment_id")
    url.searchParams.set("lines", lineRange)
    return `${url.pathname}?${url.searchParams.toString()}`
  }

  appPermalink({ repoName, sourceUrl, commentId }) {
    const url = new URL(window.location.href)

    if (repoName) {
      url.searchParams.set("repo", repoName)
    } else {
      url.searchParams.delete("repo")
    }

    if (sourceUrl) {
      url.searchParams.set("source_url", sourceUrl)
    } else {
      url.searchParams.delete("source_url")
    }

    if (commentId) {
      url.searchParams.set("comment_id", String(commentId))
    } else {
      url.searchParams.delete("comment_id")
    }

    return `${url.pathname}?${url.searchParams.toString()}`
  }

  updateQueryParams({ repoName, sourceUrl, commentId }) {
    const params = new URLSearchParams(window.location.search)

    if (repoName) {
      params.set("repo", repoName)
    } else {
      params.delete("repo")
    }

    if (sourceUrl) {
      params.set("source_url", sourceUrl)
    } else {
      params.delete("source_url")
    }

    if (commentId) {
      params.set("comment_id", String(commentId))
    } else {
      params.delete("comment_id")
    }

    const next = params.toString()
    const url = `${window.location.pathname}${next ? `?${next}` : ""}`
    window.history.replaceState({}, "", url)
  }

  scrollToFocusedComment() {
    if (!this.focusCommentId) return

    const node = this.documentPreviewTarget.querySelector(`#comment-${CSS.escape(String(this.focusCommentId))}`)
    if (!node) return

    setTimeout(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 40)
  }

  commentUrl(template, commentId) {
    return template.replace(":id", commentId)
  }

  numberOrNull(value) {
    if (!value) return null
    const number = parseInt(value, 10)
    return Number.isNaN(number) ? null : number
  }

  csrfToken() {
    const tag = document.querySelector('meta[name="csrf-token"]')
    return tag ? tag.content : ""
  }

  showError(message) {
    this.errorBoxTarget.innerHTML = `<div class="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${this.escapeHtml(message)}</div>`
  }

  clearError() {
    this.errorBoxTarget.innerHTML = ""
  }

  async copyText(value) {
    try {
      await navigator.clipboard.writeText(value)
      this.showError("Link copied to clipboard.")
      setTimeout(() => this.clearError(), 1200)
    } catch (_error) {
      this.showError("Unable to copy link. Copy it manually from the browser address bar.")
    }
  }

  escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
  }
}
