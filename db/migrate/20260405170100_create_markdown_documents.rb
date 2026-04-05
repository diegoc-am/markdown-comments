class CreateMarkdownDocuments < ActiveRecord::Migration[8.1]
  def change
    create_table :markdown_documents do |t|
      t.string :path, null: false
      t.string :title
      t.string :content_sha

      t.timestamps
    end

    add_index :markdown_documents, :path, unique: true
  end
end
