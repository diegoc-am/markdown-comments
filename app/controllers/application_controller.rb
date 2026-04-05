class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes

  helper_method :current_user, :user_signed_in?, :github_oauth_configured?, :github_oauth_missing_vars

  private

  def current_user
    @current_user ||= User.find_by(id: session[:user_id]) if session[:user_id]
  end

  def user_signed_in?
    current_user.present?
  end

  def authenticate_user!
    return if user_signed_in?

    respond_to do |format|
      format.json { render json: { error: "Authentication required" }, status: :unauthorized }
      format.any { redirect_to "/auth/github", alert: "Please sign in with GitHub first." }
    end
  end

  def github_oauth_configured?
    Rails.application.config.x.github_oauth_configured
  end

  def github_oauth_missing_vars
    Rails.application.config.x.github_oauth_missing_vars || []
  end
end
