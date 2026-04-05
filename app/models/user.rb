class User < ApplicationRecord
  has_many :comments, dependent: :destroy
  has_many :resolved_comments, class_name: "Comment", foreign_key: :resolved_by_id, inverse_of: :resolved_by

  validates :github_uid, presence: true, uniqueness: true
  validates :github_login, presence: true, uniqueness: true

  def self.from_github_auth(auth)
    uid = auth.uid.to_s
    info = auth.info || {}

    user = find_or_initialize_by(github_uid: uid)
    user.github_login = info[:nickname] || info["nickname"] || info[:name] || info["name"] || "github-user-#{uid}"
    user.name = info[:name] || info["name"]
    user.email = info[:email] || info["email"]
    user.avatar_url = info[:image] || info["image"]
    user.save!
    user
  end
end
