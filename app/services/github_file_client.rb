require "json"
require "net/http"

class GithubFileClient
  class FetchError < StandardError; end

  USER_AGENT = "markdown-comments-app"

  def fetch!(reference, token: nil)
    content = get_text!(reference.raw_url, token: token)
    commit_sha = fetch_commit_sha(reference, token: token)

    {
      content:,
      commit_sha:
    }
  end

  private

  def fetch_commit_sha(reference, token: nil)
    payload = get_json!(reference.commit_api_url, token: token)
    first = payload.first
    return nil if first.blank?

    first["sha"]
  end

  def get_text!(url, token: nil)
    uri = URI.parse(url)
    response = request(uri, token: token)
    return response.body if response.is_a?(Net::HTTPSuccess)

    if [ 401, 403, 404 ].include?(response.code.to_i)
      raise FetchError, "Unable to access file content. Ensure you have repository access and granted OAuth repo scope."
    end

    raise FetchError, "Unable to fetch file content (#{response.code})"
  end

  def get_json!(url, token: nil)
    uri = URI.parse(url)
    response = request(uri, token: token)
    return JSON.parse(response.body) if response.is_a?(Net::HTTPSuccess)

    return [] if response.code.to_i == 404

    if [ 401, 403 ].include?(response.code.to_i)
      raise FetchError, "Unable to fetch commit metadata. Ensure OAuth token has private repository access."
    end

    raise FetchError, "Unable to fetch commit metadata (#{response.code})"
  end

  def request(uri, token: nil)
    request = Net::HTTP::Get.new(uri)
    request["Accept"] = "application/vnd.github+json"
    request["User-Agent"] = USER_AGENT

    request_token = token.presence || ENV["GITHUB_TOKEN"].presence
    request["Authorization"] = "Bearer #{request_token}" if request_token

    Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") do |http|
      http.request(request)
    end
  end
end
