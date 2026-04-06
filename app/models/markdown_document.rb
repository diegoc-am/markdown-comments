class MarkdownDocument < ApplicationRecord
  has_many :comments, dependent: :destroy

  before_validation :normalize_path

  validates :path, presence: true
  validates :source_url, uniqueness: true, allow_blank: true

  def self.track!(path)
    normalized_path = normalize_path_value(path)
    find_or_create_by!(path: normalized_path)
  end

  def self.track_from_source!(source_url, github_token: nil)
    reference = GithubFileReference.parse!(source_url)
    client = GithubFileClient.new
    file_data = client.fetch!(reference, token: github_token)

    document = find_or_initialize_by(source_url: reference.canonical_url)
    document.path = normalize_path_value(reference.file_path)
    document.title = File.basename(reference.file_path)
    document.repository_name = reference.repo_name
    document.repository_ref = reference.ref
    document.content_sha = file_data[:commit_sha]
    document.content_cache = file_data[:content]
    document.save!

    {
      document:,
      content: file_data[:content],
      commit_sha: file_data[:commit_sha]
    }
  end

  def self.normalize_path_value(value)
    value.to_s.strip.sub(%r{^/+}, "")
  end

  private

  def normalize_path
    self.path = self.class.normalize_path_value(path)
  end
end
