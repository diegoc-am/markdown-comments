module Api
  module V1
    class CommentsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_comment, only: %i[update destroy]
      before_action :authorize_update!, only: :update
      before_action :authorize_owner!, only: :destroy

      def index
        if params[:source_url].present?
          result = MarkdownDocument.track_from_source!(params[:source_url], github_token: current_user_github_token!)
          comments = result[:document].comments.includes(:user, :markdown_document).order(created_at: :desc)

          render json: {
            document: serialize_document(result[:document], result[:content], result[:commit_sha]),
            comments: comments.map { |comment| serialize_comment(comment) }
          }
          return
        end

        comments = Comment.includes(:user, :markdown_document)
        comments = comments.joins(:markdown_document).where(markdown_documents: { path: MarkdownDocument.normalize_path_value(params[:path]) }) if params[:path].present?
        comments = comments.order(created_at: :desc)

        render json: { comments: comments.map { |comment| serialize_comment(comment) } }
      rescue GithubFileReference::InvalidUrlError, GithubFileClient::FetchError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      def create
        comment = if comment_params[:source_url].present?
                    Comment.create_for_source_url!(
                      user: current_user,
                      source_url: comment_params[:source_url],
                      github_token: current_user_github_token!,
                      body: comment_params[:body],
                      line_start: comment_params[:line_start],
                      line_end: comment_params[:line_end],
                      anchor: comment_params[:anchor] || {},
                      parent: parent_comment
                    )
        else
                    Comment.create_for_path!(
                      user: current_user,
                      path: comment_params[:path],
                      body: comment_params[:body],
                      line_start: comment_params[:line_start],
                      line_end: comment_params[:line_end],
                      anchor: comment_params[:anchor] || {},
                      parent: parent_comment
                    )
        end

        render json: { comment: serialize_comment(comment) }, status: :created
      rescue ActiveRecord::RecordInvalid, GithubFileReference::InvalidUrlError, GithubFileClient::FetchError, MissingGithubTokenError => e
        return render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity if e.is_a?(ActiveRecord::RecordInvalid)

        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      end

      def show
        comment = Comment.includes(:user, :markdown_document).find(params[:id])
        render json: { comment: serialize_comment(comment) }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Comment not found" }, status: :not_found
      end

      def update
        attrs = update_params.to_h

        if attrs.key?("status")
          if attrs["status"] == "resolved"
            attrs["resolved_by"] = current_user
            attrs["resolved_at"] = Time.current
          else
            attrs["resolved_by"] = nil
            attrs["resolved_at"] = nil
          end
        end

        @comment.update!(attrs)
        render json: { comment: serialize_comment(@comment) }
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @comment.destroy!
        head :no_content
      end

      private

      def set_comment
        @comment = Comment.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Comment not found" }, status: :not_found
      end

      def authorize_owner!
        return if @comment.user_id == current_user.id

        render json: { error: "You do not have permission to modify this comment" }, status: :forbidden
      end

      def authorize_update!
        return if status_only_update?
        return if @comment.user_id == current_user.id

        render json: { error: "You do not have permission to modify this comment" }, status: :forbidden
      end

      def status_only_update?
        allowed = %w[status]
        keys = update_params.to_h.keys
        keys.present? && (keys - allowed).empty?
      end

      def comment_params
        params.require(:comment).permit(:path, :source_url, :body, :line_start, :line_end, :parent_id, anchor: {})
      end

      def update_params
        params.require(:comment).permit(:body, :line_start, :line_end, :status, anchor: {})
      end

      def parent_comment
        return if comment_params[:parent_id].blank?

        Comment.find(comment_params[:parent_id])
      end

      class MissingGithubTokenError < StandardError; end

      def current_user_github_token!
        token = current_user.github_access_token
        return token if token.present?

        raise MissingGithubTokenError, "GitHub access token is missing. Sign out and sign in again to grant repository access."
      end

      def serialize_comment(comment)
        {
          id: comment.id,
          body: comment.body,
          status: comment.status,
          path: comment.markdown_document.path,
          line_start: comment.line_start,
          line_end: comment.line_end,
          anchor: comment.anchor,
          source_url: comment.markdown_document.source_url,
          source_commit_sha: comment.source_commit_sha,
          parent_id: comment.parent_id,
          resolved_at: comment.resolved_at,
          resolved_by_id: comment.resolved_by_id,
          user: {
            id: comment.user_id,
            github_login: comment.user.github_login,
            avatar_url: comment.user.avatar_url
          },
          created_at: comment.created_at,
          updated_at: comment.updated_at
        }
      end

      def serialize_document(document, content, commit_sha)
        {
          id: document.id,
          title: document.title,
          path: document.path,
          source_url: document.source_url,
          repository_name: document.repository_name,
          repository_ref: document.repository_ref,
          commit_sha: commit_sha || document.content_sha,
          content: content || document.content_cache
        }
      end
    end
  end
end
