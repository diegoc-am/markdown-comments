class SessionsController < ApplicationController
  skip_forgery_protection only: :create

  def new
    return redirect_to("/auth/github") if github_oauth_configured?

    redirect_to root_path, alert: "GitHub sign in is unavailable: missing #{github_oauth_missing_vars.join(", ")}."
  end

  def create
    return redirect_to(root_path, alert: "GitHub sign in is unavailable right now.") unless github_oauth_configured?

    auth = request.env["omniauth.auth"]
    return redirect_to(root_path, alert: "GitHub authentication failed") if auth.blank?

    user = User.from_github_auth(auth)
    session[:user_id] = user.id

    redirect_to "/auth/success", notice: "Signed in as @#{user.github_login}."
  rescue ActiveRecord::RecordInvalid => e
    redirect_to root_path, alert: e.record.errors.full_messages.to_sentence
  end

  def success
    return redirect_to(root_path, alert: "Please sign in first.") unless user_signed_in?

    @github_login = params[:login].presence || current_user.github_login
  end

  def destroy
    reset_session
    redirect_to root_path, notice: "Signed out."
  end

  def failure
    message = params[:message].presence || "GitHub authentication failed"

    respond_to do |format|
      format.json { render json: { error: message }, status: :unauthorized }
      format.any { redirect_to root_path, alert: message }
    end
  end
end
