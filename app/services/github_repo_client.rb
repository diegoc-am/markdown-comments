require "json"
require "net/http"

class GithubRepoClient
  class FetchError < StandardError; end

  USER_AGENT = "markdown-comments-app"

  def fetch_visible_repositories!(token:)
    raise FetchError, "GitHub access token is missing. Sign out and sign in again." if token.blank?

    url = "https://api.github.com/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&sort=updated&per_page=100"
    payload = get_json!(url, token)

    payload.map do |repo|
      full_name = repo["full_name"]
      default_branch = repo["default_branch"].presence || "main"

      {
        full_name: full_name,
        html_url: repo["html_url"],
        private: repo["private"],
        default_branch: default_branch,
        default_markdown_url: "https://github.com/#{full_name}/blob/#{default_branch}/README.md"
      }
    end
  end

  private

  def get_json!(url, token)
    uri = URI.parse(url)
    response = request(uri, token)
    return JSON.parse(response.body) if response.is_a?(Net::HTTPSuccess)

    if [ 401, 403 ].include?(response.code.to_i)
      raise FetchError, "Unable to read repositories. Ensure OAuth includes repo access."
    end

    raise FetchError, "Unable to fetch repositories (#{response.code})"
  end

  def request(uri, token)
    request = Net::HTTP::Get.new(uri)
    request["Accept"] = "application/vnd.github+json"
    request["User-Agent"] = USER_AGENT
    request["Authorization"] = "Bearer #{token}"

    Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") do |http|
      http.request(request)
    end
  end
end
