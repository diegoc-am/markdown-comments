class CreateComments < ActiveRecord::Migration[8.1]
  def change
    create_table :comments do |t|
      t.references :user, null: false, foreign_key: true
      t.references :markdown_document, null: false, foreign_key: true
      t.references :parent, foreign_key: { to_table: :comments }
      t.references :resolved_by, foreign_key: { to_table: :users }
      t.text :body, null: false
      t.integer :line_start
      t.integer :line_end
      t.jsonb :anchor, null: false, default: {}
      t.integer :status, null: false, default: 0
      t.datetime :resolved_at

      t.timestamps
    end

    add_index :comments, :status
  end
end
