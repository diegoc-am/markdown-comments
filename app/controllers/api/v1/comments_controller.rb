module Api
  module V1
    class CommentsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_comment, only: %i[update destroy]
      before_action :authorize_update!, only: :update
      before_action :authorize_owner!, only: :destroy

      def index
        comments = Comment.includes(:user, :markdown_document)
        comments = comments.joins(:markdown_document).where(markdown_documents: { path: MarkdownDocument.normalize_path_value(params[:path]) }) if params[:path].present?
        comments = comments.order(created_at: :desc)

        render json: { comments: comments.map { |comment| serialize_comment(comment) } }
      end

      def create
        comment = Comment.create_for_path!(
          user: current_user,
          path: comment_params[:path],
          body: comment_params[:body],
          line_start: comment_params[:line_start],
          line_end: comment_params[:line_end],
          anchor: comment_params[:anchor] || {},
          parent: parent_comment
        )

        render json: { comment: serialize_comment(comment) }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
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
        params.require(:comment).permit(:path, :body, :line_start, :line_end, :parent_id, anchor: {})
      end

      def update_params
        params.require(:comment).permit(:body, :line_start, :line_end, :status, anchor: {})
      end

      def parent_comment
        return if comment_params[:parent_id].blank?

        Comment.find(comment_params[:parent_id])
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
    end
  end
end
