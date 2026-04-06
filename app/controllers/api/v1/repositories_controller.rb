require "set"

module Api
  module V1
    class RepositoriesController < ApplicationController
      before_action :authenticate_user!

      def index
        repos = GithubRepoClient.new.fetch_visible_repositories!(token: current_user_github_token!)
        render json: { groups: group_repositories(repos) }
      rescue GithubRepoClient::FetchError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      private

      def current_user_github_token!
        token = current_user.github_access_token
        return token if token.present?

        raise GithubRepoClient::FetchError, "GitHub access token is missing. Sign out and sign in again to grant repository access."
      end

      def group_repositories(repos)
        repo_names = repos.map { |repo| repo[:full_name] }
        repo_files = repository_files_index(repo_names)
        user_repo_names = Set.new(repo_files.filter_map { |repo_name, files| repo_name if files.any? { |file| file[:my_comments].positive? } })
        commented_repo_names = Set.new(repo_files.filter_map { |repo_name, files| repo_name if files.any? { |file| file[:total_comments].positive? } })

        my_repos = repos.select { |repo| user_repo_names.include?(repo[:full_name]) }
        commented_repos = repos.select { |repo| !user_repo_names.include?(repo[:full_name]) && commented_repo_names.include?(repo[:full_name]) }
        other_repos = repos.select { |repo| !user_repo_names.include?(repo[:full_name]) && !commented_repo_names.include?(repo[:full_name]) }

        [
          {
            key: "mine",
            title: "Repositories you commented on",
            repositories: decorate_repos(my_repos, repo_files, %w[you_commented])
          },
          {
            key: "with_comments",
            title: "Repositories with existing comments",
            repositories: decorate_repos(commented_repos, repo_files, %w[has_comments])
          },
          {
            key: "others",
            title: "Other visible repositories",
            repositories: decorate_repos(other_repos, repo_files, %w[visible_to_you])
          }
        ]
      end

      def repository_files_index(repo_names)
        rows = Comment
          .joins(:markdown_document)
          .where(markdown_documents: { repository_name: repo_names })
          .where.not(markdown_documents: { source_url: [ nil, "" ] })
          .pluck(
            "markdown_documents.repository_name",
            "markdown_documents.source_url",
            "markdown_documents.path",
            "comments.user_id",
            "comments.id"
          )

        index = Hash.new { |hash, key| hash[key] = {} }

        rows.each do |repo_name, source_url, path, user_id, comment_id|
          file_entry = index[repo_name][source_url] ||= {
            source_url: source_url,
            path: path,
            total_comments: 0,
            my_comments: 0,
            latest_comment_id: comment_id
          }

          file_entry[:total_comments] += 1
          file_entry[:my_comments] += 1 if user_id == current_user.id
          file_entry[:latest_comment_id] = [ file_entry[:latest_comment_id], comment_id ].compact.max
        end

        index.transform_values do |files|
          files.values.sort_by { |entry| [ -entry[:my_comments], -entry[:total_comments], entry[:path] ] }
        end
      end

      def decorate_repos(repos, repo_files, tags)
        repos.map do |repo|
          files = repo_files.fetch(repo[:full_name], [])
          files = [ default_file_entry(repo) ] if files.empty?

          {
            full_name: repo[:full_name],
            private: repo[:private],
            html_url: repo[:html_url],
            tags: tags,
            files: files
          }
        end
      end

      def default_file_entry(repo)
        {
          source_url: repo[:default_markdown_url],
          path: "README.md",
          total_comments: 0,
          my_comments: 0,
          latest_comment_id: nil
        }
      end
    end
  end
end
