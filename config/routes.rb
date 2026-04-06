Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  root "dashboard#index"

  get "/login", to: "sessions#new"
  get "/auth/github/callback", to: "sessions#create"
  get "/auth/success", to: "sessions#success"
  get "/auth/failure", to: "sessions#failure"
  delete "/logout", to: "sessions#destroy"

  namespace :api do
    namespace :v1 do
      resources :repositories, only: :index
      resources :comments, only: %i[index show create update destroy]
    end
  end
end
