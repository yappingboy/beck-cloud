<#import "template.ftl" as layout>
<@layout.displayLayout>
  <div id="kc-logo-wrapper">
    <svg id="kc-logo" viewBox="0 0 240 48" xmlns="http://www.w3.org/2000/svg" aria-label="BeckCloud">
      <g>
        <path d="M28,2 C44,2 60,12 60,28 C60,44 44,54 28,54 C12,54 0,44 0,28 C0,12 12,2 28,2Z"
              stroke="#E8A838" stroke-width="2.5" fill="none"/>
        <path d="M28,12 C34,18 40,28 38,36 C36,44 32,50 28,50 C24,50 20,44 18,36 C16,28 22,18 28,12Z"
              fill="#E8A838" opacity="0.9"/>
      </g>
      <text x="76" y="34" font-family="'JetBrains Mono', monospace" font-weight="700" font-size="26" letter-spacing="-0.5">
        <tspan fill="#E8A838">Beck</tspan>
        <tspan fill="url(#cloud-grad)">Cloud</tspan>
      </text>
      <defs>
        <linearGradient id="cloud-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#E8A838"/>
          <stop offset="100%" stop-color="#FF6B4A"/>
        </linearGradient>
      </defs>
    </svg>
  </div>

  <div id="kc-header-wrapper">
    <div id="kc-header">${msg("resetTitle")}</div>
    <div id="kc-header-subtitle">${msg("resetPasswordTitle")}</div>
  </div>

  <div id="kc-card">
    <#if !auth?has_content || !auth.showUsername()>
      <#if !auth.showEmail()??>
        <form id="kc-reset-password-form" action="${url.loginResetFormUrl}" method="post">
          <div class="form-group">
            <label for="username" class="form-label">${msg("username")}</label>
            <input type="text" id="username" class="form-control" name="username"
                   value="${(auth.attemptedUsername!'')}" autocomplete="username" placeholder="${msg('loginUsernameHint')}" autofocus/>
          </div>

          <div id="kc-form-buttons">
            <button type="submit" id="kc-reset-log-in" class="kc-btn kc-btn-primary">${msg("doResetPassword")}</button>
          </div>
        </form>
      <#else>
        <form id="kc-reset-password-form" action="${url.loginResetFormUrl}" method="post">
          <div class="form-group">
            <label for="username" class="form-label">${msg("username")}</label>
            <input type="text" id="username" class="form-control" name="username"
                   value="${(auth.attemptedUsername!'')}" autocomplete="username" placeholder="${msg('loginUsernameHint')}" autofocus/>
          </div>

          <div class="form-group">
            <label for="email" class="form-label">${msg("email")}</label>
            <input type="email" id="email" class="form-control" name="email"
                   value="${(auth.attemptedEmail!'')}" autocomplete="email" placeholder="you@example.com"/>
          </div>

          <div id="kc-form-buttons">
            <button type="submit" id="kc-reset-log-in" class="kc-btn kc-btn-primary">${msg("doResetPassword")}</button>
          </div>
        </form>
      </#if>

      <div id="kc-footer-links" style="margin-top: 1rem; text-align: center;">
        <a href="${url.loginUrl}">${msg("loginIdpConfirmDifferent")}</a>
      </div>
    <#else>
      <form id="kc-reset-password-form" action="${url.loginResetFormUrl}" method="post">
        <div class="form-group">
          <label for="username" class="form-label">${msg("username")}</label>
          <input type="text" id="username" class="form-control" name="username"
                 value="${auth.username!''}" readonly tabindex="-1"
                 style="opacity: 0.7; cursor: default;"/>
        </div>

        <div id="kc-form-buttons">
          <button type="submit" id="kc-reset-log-in" class="kc-btn kc-btn-primary">${msg("doResetPassword")}</button>
        </div>
      </form>
    </#if>
  </div>
</@layout.displayLayout>
