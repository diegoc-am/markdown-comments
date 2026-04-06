class AddSourceMetadataToMarkdownDocumentsAndComments < ActiveRecord::Migration[8.1]
  def change
    add_column :markdown_documents, :source_url, :string
    add_column :markdown_documents, :repository_name, :string
    add_column :markdown_documents, :repository_ref, :string
    add_column :markdown_documents, :content_cache, :text

    add_column :comments, :source_commit_sha, :string

    remove_index :markdown_documents, :path if index_exists?(:markdown_documents, :path)
    add_index :markdown_documents, :path
    add_index :markdown_documents, :source_url, unique: true
    add_index :comments, :source_commit_sha
  end
end
