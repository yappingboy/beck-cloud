Defaulted container "manyfold" out of: manyfold, init-permissions (init)
class ApplicationController < ActionController::Base
  include Pundit::Authorization
  include BetterContentSecurityPolicy::HasContentSecurityPolicy

  after_action :verify_authorized, except: -> { respond_to?(:fasp_client_controller?) || action_name == "index" }
  after_action :verify_policy_scoped, only: :index, unless: -> { respond_to?(:fasp_client_controller?) }
  after_action :set_content_security_policy_header, if: -> { request.format.html? }

  before_action :authenticate_user!, unless: -> { SiteSettings.multiuser_enabled? || has_signed_id? || doorkeeper_token_valid? }
  around_action :switch_locale, if: -> { request.format.html? }
  before_action :register_admin_user
  before_action :set_up_first_library
  before_action :show_security_alerts
  before_action :check_scan_status
  before_action :restore_failed_search

  protect_from_forgery with: :null_session, if: :is_api_request?

  rescue_from ScopedSearch::QueryNotSupported, with: -> {
    flash[:alert] = t("application.search_error")
    flash[:query] = params[:q]
    redirect_back_or_to helpers.landing_page_path
  }

  unless Rails.env.test?
    rescue_from Pundit::NotAuthorizedError, with: :user_not_authorized
  end

  def index
    skip_policy_scope
    redirect_to helpers.landing_page_path
  end

  private

  def authenticate_admin_user!
    authenticate_user!
    render plain: "401 Unauthorized", status: :unauthorized unless current_user&.is_administrator?
  end

  def register_admin_user
    authenticate_user! if User.all.empty?
    if current_user&.first_use?
      redirect_to(edit_user_registration_path)
    end
  end

  def set_up_first_library
    return unless Library.none?
    if current_user&.is_administrator? && !current_user&.first_use?
      redirect_to(new_library_path)
    else
      redirect_to(about_path, notice: t("general.setup_mode"))
    end
  end

  def check_scan_status
    @scan_in_progress = Sidekiq::Queue.new("scan").size > 0
  end

  def restore_failed_search
    @query ||= flash[:query]
  end

  def is_api_request?
    request.format.manyfold_api_v0?
  end

  def has_signed_id?
    params[:sig] && ApplicationRecord.signed_id_verifier.valid_message?(params[:sig])
  end

  def img_src
    host = begin
      SiteSettings.site_icon ? URI.parse(SiteSettings.site_icon).host : nil
    rescue
      nil
    end
    [
      :self,
      :data,
      host,
      "https://cdn.jsdelivr.net",
      "https://raw.githubusercontent.com",
      SiteSettings.federation_enabled? ? :https : nil
    ].compact
  end

  def frame_src
    [
      :self,
      SiteSettings.federation_enabled? ? :https : nil
    ].compact
  end

  def configure_content_security_policy
    return if Rails.env.test?

    content_security_policy.default_src :self
    content_security_policy.connect_src :self
    content_security_policy.frame_ancestors :self
    content_security_policy.frame_src(*frame_src)
    content_security_policy.font_src :self, "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"
    content_security_policy.img_src(*img_src)
    content_security_policy.worker_src :self, :blob
    content_security_policy.object_src :none
    content_security_policy.script_src :self
    content_security_policy.style_src :self
    content_security_policy.style_src_attr :unsafe_inline
    content_security_policy.style_src_elem :self, "https://fonts.googleapis.com"
    origins = Library.all.filter_map(&:storage_origin)
    content_security_policy.img_src(*origins)
    content_security_policy.connect_src(*origins)
    if Rails.env.development?
      content_security_policy.connect_src("wss:", "ws:")
    end
    if Rails.env.development? && ENV.fetch("SCOUT_DEV_TRACE", false) === "true"
      scout_csp = [:unsafe_inline, "https://apm.scoutapp.com", "https://scoutapm.com"]
      content_security_policy.img_src(*scout_csp)
      content_security_policy.script_src(*scout_csp)
      content_security_policy.style_src(*scout_csp)
      content_security_policy.style_src_elem(*scout_csp)
      content_security_policy.connect_src(*scout_csp)
      content_security_policy.frame_src(*scout_csp)
    else
      content_security_policy.script_src "nonce-#{content_security_policy_nonce}"
      content_security_policy.style_src_elem "nonce-#{content_security_policy_nonce}"
    end
  end

  def switch_locale(&action)
    locale = current_user&.interface_language || request.env["rack.locale"]
    I18n.with_locale(locale.presence, &action)
  end

  def show_security_alerts
    return unless current_user&.is_administrator?
    return if ENV.fetch("SUDO_RUN_UNSAFELY", nil) === "enabled"
    flash.now[:alert] = t("security.running_as_root_html") if Process.uid == 0
  end

  def random_delay
    sleep Random.new.rand(2.0)
  end

  def user_not_authorized
    if current_user
      raise ActiveRecord::RecordNotFound
    else
      redirect_to new_session_path(:user)
    end
  end

  private

  def authenticate_doorkeeper!
    token_string = request.authorization.to_s.sub(/^Bearer /i, "").strip
    if token_string.present?
      access_token = Doorkeeper::AccessToken.find_by(token: token_string)
      @doorkeeper_user = User.find(access_token.resource_owner_id) if access_token&.accessible?
    end
  end

  def doorkeeper_token_valid?
    token_string = request.authorization.to_s.sub(/^Bearer /i, "").strip
    if token_string.present?
      access_token = Doorkeeper::AccessToken.find_by(token: token_string)
      access_token&.accessible?
    else
      false
    end
  end

  def current_user
    return @doorkeeper_user if @doorkeeper_user
    super
  end

  def set_indexable(content)
    arr = Array(content)
    @indexing_directives = [
      ("noindex" unless arr.map(&:indexable?).all?),
      ("noai noimageai" unless arr.map(&:ai_indexable?).all?)
    ].compact.join(" ")
    response.headers["X-Robots-Tag"] = @indexing_directives if @indexing_directives.presence
  end

  def send_file_content(attachment, disposition: :attachment, derivative: nil)
    head :not_found and return if attachment.nil?
    redirect_to(attachment.url, allow_other_host: true) if /https?:\/\//.match?(attachment.url)
    status, headers, body = attachment.to_rack_response(disposition: disposition)
    self.status = status
    self.headers.merge!(headers)
    self.response_body = body
    request.session_options[:skip] = true
  rescue Errno::ENOENT
    head :internal_server_error
  end
end
