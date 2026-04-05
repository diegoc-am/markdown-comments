required_github_oauth_vars = %w[GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET].freeze
missing_github_oauth_vars = required_github_oauth_vars.select { |env_var| ENV[env_var].blank? }
github_client_id = ENV["GITHUB_CLIENT_ID"]
github_client_secret = ENV["GITHUB_CLIENT_SECRET"]

OmniAuth.config.allowed_request_methods = %i[get post]
OmniAuth.config.silence_get_warning = true

Rails.application.config.x.github_oauth_configured = missing_github_oauth_vars.empty?
Rails.application.config.x.github_oauth_missing_vars = missing_github_oauth_vars

if missing_github_oauth_vars.empty?
  Rails.application.config.middleware.use OmniAuth::Builder do
    provider :github, github_client_id, github_client_secret, scope: "read:user,user:email"
  end
else
  message = "GitHub OAuth is disabled. Missing: #{missing_github_oauth_vars.join(", ")}."

  if Rails.env.production?
    raise message
  end

  Rails.logger.warn("#{message} Sign in is unavailable until these variables are configured.")
end
