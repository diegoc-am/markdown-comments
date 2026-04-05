require "test_helper"

class AuthAndCommentsFlowTest < ActionDispatch::IntegrationTest
  setup do
    @original_oauth_configured = Rails.application.config.x.github_oauth_configured
    @original_oauth_missing_vars = Rails.application.config.x.github_oauth_missing_vars
    Rails.application.config.x.github_oauth_configured = true
    Rails.application.config.x.github_oauth_missing_vars = []
  end

  teardown do
    Rails.application.config.x.github_oauth_configured = @original_oauth_configured
    Rails.application.config.x.github_oauth_missing_vars = @original_oauth_missing_vars
  end

  test "oauth callback signs in a user" do
    with_mocked_omniauth_auth(github_auth_hash(uid: "123", nickname: "octocat")) do
      get "/auth/github/callback"
    end

    assert_redirected_to "/auth/success"
    assert_equal "octocat", User.find_by!(github_uid: "123").github_login

    get "/"
    assert_response :success
    assert_includes response.body, "@octocat"
  end

  test "comments api basic lifecycle for authenticated user" do
    assert_comment_api_requires_authentication

    sign_in_as(uid: "200", nickname: "reviewer")

    post "/api/v1/comments",
         params: { comment: { path: "README.md", body: "Looks good", line_start: 3, line_end: 5 } },
         as: :json

    assert_response :created
    created_comment = response.parsed_body.fetch("comment")
    comment_id = created_comment.fetch("id")
    assert_equal "open", created_comment.fetch("status")
    assert_equal "README.md", created_comment.fetch("path")

    get "/api/v1/comments", params: { path: "README.md" }, as: :json
    assert_response :success
    assert_equal 1, response.parsed_body.fetch("comments").size

    patch "/api/v1/comments/#{comment_id}", params: { comment: { status: "resolved" } }, as: :json
    assert_response :success
    updated_comment = response.parsed_body.fetch("comment")
    assert_equal "resolved", updated_comment.fetch("status")
    assert_equal User.find_by!(github_uid: "200").id, updated_comment.fetch("resolved_by_id")

    delete "/api/v1/comments/#{comment_id}", as: :json
    assert_response :no_content

    get "/api/v1/comments", params: { path: "README.md" }, as: :json
    assert_response :success
    assert_equal [], response.parsed_body.fetch("comments")
  end

  private

  def assert_comment_api_requires_authentication
    get "/api/v1/comments", as: :json
    assert_response :unauthorized
    assert_equal "Authentication required", response.parsed_body.fetch("error")
  end

  def sign_in_as(uid:, nickname:)
    with_mocked_omniauth_auth(github_auth_hash(uid: uid, nickname: nickname)) do
      get "/auth/github/callback"
    end

    assert_redirected_to "/auth/success"
    follow_redirect!
    assert_response :success
  end

  def github_auth_hash(uid:, nickname:)
    OmniAuth::AuthHash.new(
      provider: "github",
      uid: uid,
      info: {
        nickname: nickname,
        name: nickname.capitalize,
        email: "#{nickname}@example.test",
        image: "https://avatars.example.test/#{nickname}.png"
      }
    )
  end

  def with_mocked_omniauth_auth(auth_hash)
    original_auth = Rails.application.env_config["omniauth.auth"]
    Rails.application.env_config["omniauth.auth"] = auth_hash
    yield
  ensure
    Rails.application.env_config["omniauth.auth"] = original_auth
  end
end
