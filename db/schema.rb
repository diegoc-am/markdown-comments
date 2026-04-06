# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_04_05_203000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "comments", force: :cascade do |t|
    t.jsonb "anchor", default: {}, null: false
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.integer "line_end"
    t.integer "line_start"
    t.bigint "markdown_document_id", null: false
    t.bigint "parent_id"
    t.datetime "resolved_at"
    t.bigint "resolved_by_id"
    t.string "source_commit_sha"
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["markdown_document_id"], name: "index_comments_on_markdown_document_id"
    t.index ["parent_id"], name: "index_comments_on_parent_id"
    t.index ["resolved_by_id"], name: "index_comments_on_resolved_by_id"
    t.index ["source_commit_sha"], name: "index_comments_on_source_commit_sha"
    t.index ["status"], name: "index_comments_on_status"
    t.index ["user_id"], name: "index_comments_on_user_id"
  end

  create_table "markdown_documents", force: :cascade do |t|
    t.text "content_cache"
    t.string "content_sha"
    t.datetime "created_at", null: false
    t.string "path", null: false
    t.string "repository_name"
    t.string "repository_ref"
    t.string "source_url"
    t.string "title"
    t.datetime "updated_at", null: false
    t.index ["path"], name: "index_markdown_documents_on_path"
    t.index ["source_url"], name: "index_markdown_documents_on_source_url", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "avatar_url"
    t.datetime "created_at", null: false
    t.string "email"
    t.string "github_access_token"
    t.string "github_login", null: false
    t.string "github_token_scopes"
    t.string "github_uid", null: false
    t.string "name"
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email"
    t.index ["github_login"], name: "index_users_on_github_login", unique: true
    t.index ["github_uid"], name: "index_users_on_github_uid", unique: true
  end

  add_foreign_key "comments", "comments", column: "parent_id"
  add_foreign_key "comments", "markdown_documents"
  add_foreign_key "comments", "users"
  add_foreign_key "comments", "users", column: "resolved_by_id"
end
