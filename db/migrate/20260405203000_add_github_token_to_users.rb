class AddGithubTokenToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :github_access_token, :string
    add_column :users, :github_token_scopes, :string
  end
end
