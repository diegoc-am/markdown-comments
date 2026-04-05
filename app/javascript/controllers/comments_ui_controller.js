import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["list", "pathFilter"]
  static values = {
    indexUrl: String,
    createUrl: String,
    updateUrlTemplate: String,
    deleteUrlTemplate: String,
    currentUserId: Number
  }

  connect() {
    this.loadComments()
  }

  async loadComments() {
    try {
      const path = this.pathFilterTarget.value.trim()
      const url = new URL(this.indexUrlValue, window.location.origin)

      if (path.length > 0) {
        url.searchParams.set("path", path)
      }

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      })

      if (!response.ok) {
        this.renderError("Unable to load comments.")
        return
      }

      const payload = await response.json()
      this.renderComments(payload.comments || [])
    } catch (_error) {
      this.renderError("Unable to load comments.")
    }
  }

  async createComment(event) {
    event.preventDefault()

    const form = event.target

    try {
      const formData = new FormData(form)
      const comment = {
        path: formData.get("path"),
        body: formData.get("body"),
        line_start: this.numberOrNull(formData.get("line_start")),
        line_end: this.numberOrNull(formData.get("line_end"))
      }

      const response = await fetch(this.createUrlValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-CSRF-Token": this.csrfToken()
        },
        credentials: "same-origin",
        body: JSON.stringify({ comment })
      })

      if (!response.ok) {
        this.renderError("Unable to save comment.")
        return
      }

      form.reset()
      this.pathFilterTarget.value = comment.path
      this.refreshMaterializeFields()
      this.loadComments()
    } catch (_error) {
      this.renderError("Unable to save comment.")
    }
  }

  async onListClick(event) {
    const button = event.target.closest("button[data-command]")
    if (!button) return

    const command = button.dataset.command
    const commentId = button.dataset.commentId

    if (!commentId) return

    if (command === "toggle-reply") {
      this.toggleReplyForm(commentId)
      return
    }

    if (command === "toggle-status") {
      const nextStatus = button.dataset.nextStatus
      await this.updateCommentStatus(commentId, nextStatus)
      return
    }

    if (command === "delete") {
      await this.deleteComment(commentId)
    }
  }

  async onListSubmit(event) {
    if (!event.target.matches("form[data-reply-form]")) return

    event.preventDefault()
    const form = event.target
    const commentId = form.dataset.commentId
    const path = form.dataset.path

    if (!commentId || !path) return

    const textarea = form.querySelector("textarea[name='reply_body']")
    const body = textarea ? textarea.value.trim() : ""

    if (!body) return

    try {
      const payload = {
        comment: {
          path,
          body,
          parent_id: parseInt(commentId, 10)
        }
      }

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

      if (!response.ok) {
        this.renderError("Unable to create reply.")
        return
      }

      form.reset()
      this.loadComments()
    } catch (_error) {
      this.renderError("Unable to create reply.")
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
        this.renderError("Unable to update comment status.")
        return
      }

      this.loadComments()
    } catch (_error) {
      this.renderError("Unable to update comment status.")
    }
  }

  async deleteComment(commentId) {
    const confirmed = window.confirm("Delete this comment and all replies?")
    if (!confirmed) return

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
        this.renderError("Unable to delete comment.")
        return
      }

      this.loadComments()
    } catch (_error) {
      this.renderError("Unable to delete comment.")
    }
  }

  toggleReplyForm(commentId) {
    const form = this.listTarget.querySelector(`form[data-reply-form][data-comment-id='${commentId}']`)
    if (!form) return

    form.classList.toggle("hidden")
    if (!form.classList.contains("hidden")) {
      const textarea = form.querySelector("textarea")
      if (textarea) textarea.focus()
    }
  }

  renderComments(comments) {
    if (comments.length === 0) {
      this.listTarget.innerHTML = '<p class="empty-state">No comments found for this path yet.</p>'
      return
    }

    const tree = this.buildThreadTree(comments)
    this.listTarget.innerHTML = this.renderCommentNodes(tree)
    this.refreshMaterializeFields()
  }

  renderError(message) {
    this.listTarget.innerHTML = `<p class="error-state">${this.escapeHtml(message)}</p>`
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

  escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
  }

  commentUrl(template, commentId) {
    return template.replace(":id", commentId)
  }

  buildThreadTree(comments) {
    const childrenByParent = new Map()

    comments.forEach((comment) => {
      const key = comment.parent_id === null ? "root" : String(comment.parent_id)
      if (!childrenByParent.has(key)) childrenByParent.set(key, [])
      childrenByParent.get(key).push(comment)
    })

    for (const [, group] of childrenByParent) {
      group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    }

    const build = (parentKey) => {
      const nodes = childrenByParent.get(parentKey) || []
      return nodes.map((comment) => ({
        comment,
        children: build(String(comment.id))
      }))
    }

    return build("root")
  }

  renderCommentNodes(nodes, depth = 0) {
    return nodes
      .map((node) => {
        const { comment, children } = node
        const isOwner = Number(comment.user.id) === this.currentUserIdValue
        const nextStatus = comment.status === "resolved" ? "open" : "resolved"
        const lines = comment.line_start ? `Lines ${comment.line_start}${comment.line_end ? `-${comment.line_end}` : ""}` : "No line selection"
        const formattedDate = this.formatDate(comment.created_at)
        const statusChipClass = comment.status === "resolved" ? "green lighten-4" : "orange lighten-4"
        const statusButtonText = comment.status === "resolved" ? "Reopen" : "Resolve"

        return `
          <article class="comment-item depth-${Math.min(depth, 4)}">
            <div class="comment-head">
              <strong>@${this.escapeHtml(comment.user.github_login)}</strong>
              <span class="chip ${statusChipClass}">${this.escapeHtml(comment.status)}</span>
            </div>

            <p class="comment-body">${this.escapeHtml(comment.body)}</p>
            <p class="comment-meta">${this.escapeHtml(comment.path)} • ${lines} • ${formattedDate}</p>

            <div class="comment-actions">
              <button type="button" class="btn-flat" data-command="toggle-reply" data-comment-id="${comment.id}">Reply</button>
              <button type="button" class="btn-flat" data-command="toggle-status" data-next-status="${nextStatus}" data-comment-id="${comment.id}">${statusButtonText}</button>
              ${isOwner ? `<button type="button" class="btn-flat red-text text-darken-2" data-command="delete" data-comment-id="${comment.id}">Delete</button>` : ""}
            </div>

            <form class="reply-form hidden" data-reply-form data-comment-id="${comment.id}" data-path="${this.escapeHtml(comment.path)}">
              <div class="input-field">
                <textarea class="materialize-textarea" name="reply_body" required></textarea>
                <label>Reply to @${this.escapeHtml(comment.user.github_login)}</label>
              </div>
              <button type="submit" class="btn-small blue darken-2">Post Reply</button>
            </form>

            ${children.length > 0 ? `<div class="comment-children">${this.renderCommentNodes(children, depth + 1)}</div>` : ""}
          </article>
        `
      })
      .join("")
  }

  formatDate(value) {
    try {
      return new Date(value).toLocaleString()
    } catch (_error) {
      return value
    }
  }

  refreshMaterializeFields() {
    if (window.M && window.M.updateTextFields) {
      window.M.updateTextFields()
    }
  }
}
