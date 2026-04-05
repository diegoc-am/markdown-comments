class Comment < ApplicationRecord
  belongs_to :user
  belongs_to :markdown_document
  belongs_to :parent, class_name: "Comment", optional: true
  belongs_to :resolved_by, class_name: "User", optional: true

  has_many :replies, class_name: "Comment", foreign_key: :parent_id, dependent: :destroy, inverse_of: :parent

  enum :status, { open: 0, resolved: 1 }

  validates :body, presence: true

  def self.create_for_path!(user:, path:, body:, line_start: nil, line_end: nil, anchor: {}, parent: nil)
    markdown_document = MarkdownDocument.track!(path)

    create!(
      user: user,
      markdown_document: markdown_document,
      body: body,
      line_start: line_start,
      line_end: line_end,
      anchor: anchor,
      parent: parent
    )
  end
end
