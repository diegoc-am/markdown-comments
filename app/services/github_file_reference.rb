require "cgi"
require "uri"

class GithubFileReference
  class InvalidUrlError < StandardError; end

  attr_reader :owner, :repo, :ref, :file_path

  def self.parse!(url)
    uri = URI.parse(url.to_s.strip)

    raise InvalidUrlError, "Only github.com URLs are supported" unless uri.host == "github.com"

    segments = uri.path.split("/").reject(&:blank?)
    raise InvalidUrlError, "Expected /owner/repo/blob/ref/path format" unless segments.length >= 5
    raise InvalidUrlError, "Expected a /blob/ URL" unless segments[2] == "blob"

    owner = segments[0]
    repo = segments[1]
    ref = CGI.unescape(segments[3])
    file_path = CGI.unescape(segments[4..].join("/"))

    raise InvalidUrlError, "File path is required" if file_path.blank?

    new(owner:, repo:, ref:, file_path:)
  rescue URI::InvalidURIError
    raise InvalidUrlError, "Invalid URL"
  end

  def initialize(owner:, repo:, ref:, file_path:)
    @owner = owner
    @repo = repo
    @ref = ref
    @file_path = file_path
  end

  def canonical_url
    "https://github.com/#{owner}/#{repo}/blob/#{escape_part(ref)}/#{escape_path(file_path)}"
  end

  def raw_url
    "https://raw.githubusercontent.com/#{owner}/#{repo}/#{escape_part(ref)}/#{escape_path(file_path)}"
  end

  def commit_api_url
    query = URI.encode_www_form(path: file_path, sha: ref, per_page: 1)
    "https://api.github.com/repos/#{owner}/#{repo}/commits?#{query}"
  end

  def repo_name
    "#{owner}/#{repo}"
  end

  private

  def escape_part(value)
    CGI.escape(value.to_s).tr("+", "%20")
  end

  def escape_path(path)
    path.to_s.split("/").map { |part| escape_part(part) }.join("/")
  end
end
