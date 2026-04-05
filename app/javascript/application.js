// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import "@hotwired/turbo-rails"
import "controllers"

document.addEventListener("turbo:load", () => {
  if (window.M && window.M.updateTextFields) {
    window.M.updateTextFields()
  }
})
