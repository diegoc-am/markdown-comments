class MarkdownDocument < ApplicationRecord
  has_many :comments, dependent: :destroy

  before_validation :normalize_path

  validates :path, presence: true, uniqueness: true

  def self.track!(path)
    normalized_path = normalize_path_value(path)
    find_or_create_by!(path: normalized_path)
  end

  def self.normalize_path_value(value)
    value.to_s.strip.sub(%r{^/+}, "")
  end

  private

  def normalize_path
    self.path = self.class.normalize_path_value(path)
  end
end
