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
    <div id="kc-header">${msg("otpTitle")}</div>
    <div id="kc-header-subtitle">${msg("otpLoginTitle")}</div>
  </div>

  <div id="kc-card">
    <#if otpLogin.isTotp() && otpLogin.userSecret?has_content && !otpLogin.userSecretConfigured>
      <div class="info-message">
        <strong>${msg("otpConfigTitle")}</strong><br/>
        ${msg("otpConfigInstructions")}
      </div>

      <div style="text-align: center; margin-bottom: 1.5rem;">
        <img src="${otpLogin.otpLoginUrl}" alt="QR Code" style="max-width: 200px; border-radius: var(--radius);"/>
      </div>

      <div class="otp-info">
        <strong>${msg("otpConfigManualEntry")}</strong><br/>
        <code style="font-family: var(--font-heading); font-size: 0.875rem; color: var(--ember);">${otpLogin.userSecret!''}</code>
      </div>
    </#if>

    <form id="kc-otp-login-form" action="${url.loginAction}" method="post">
      <div class="otp-info">
        ${msg("otpType")}: ${msg("otp${otpLogin.authenticatorConfig.type}")}
      </div>

      <div class="otp-input-group">
        <input type="text" id="otp" class="otp-input" name="otp" inputmode="numeric"
               maxlength="6" placeholder="000000" autofocus
               autocomplete="one-time-code"/>
      </div>

      <div class="form-group" id="kc-form-options">
        <div class="checkbox-group" style="justify-content: center;">
          <input type="checkbox" id="rememberMe" name="rememberMe" value="on"/>
          <label for="rememberMe" class="checkbox-label">${msg("otpRemember")}</label>
        </div>
      </div>

      <div id="kc-form-buttons">
        <button type="submit" id="kc-login" class="kc-btn kc-btn-primary">${msg("doSubmit")}</button>
      </div>
    </form>

    <div id="kc-footer-links" style="margin-top: 1rem; text-align: center;">
      <a href="${url.loginUrl}">${msg("loginIdpConfirmDifferent")}</a>
      <#if otpLogin.isTotp() && !otpLogin.userSecretConfigured>
        <a href="${url.loginUrl}?retry=true">${msg("otpReset")}</a>
      </#if>
    </div>
  </div>
</@layout.displayLayout>
