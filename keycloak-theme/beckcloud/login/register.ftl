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
    <div id="kc-header">${msg("registerTitle")}</div>
    <div id="kc-header-subtitle">${msg("registerTitleCreateAccount")}</div>
  </div>

  <div id="kc-card">
    <#if !realm.emailAsUsername && !userCreatedAccount>
      <form id="kc-register-form" action="${url.registrationAction}" method="post">
        <div class="form-group">
          <label for="username" class="form-label">${msg("username")}</label>
          <input type="text" id="username" class="form-control" name="username"
                 value="${register.username}" autocomplete="username" placeholder="${msg('loginUsernameHint')}" autofocus/>
          <#if errors.usernameExist??>
            <span class="error-text">${msg("errorUsernameAlreadyExists")}</span>
          </#if>
        </div>

        <div class="form-group">
          <label for="email" class="form-label">${msg("email")}</label>
          <input type="email" id="email" class="form-control" name="email"
                 value="${register.email}" autocomplete="email" placeholder="you@example.com"/>
          <#if errors.emailExists??>
            <span class="error-text">${msg("errorEmailAlreadyExists")}</span>
          </#if>
        </div>

        <div class="form-group">
          <label for="password" class="form-label">${msg("password")}</label>
          <input type="password" id="password" class="form-control" name="password"
                 autocomplete="new-password" placeholder="••••••••"/>
          <div id="password-strength">
            <div id="password-strength-meter">
              <div id="password-strength-meter-fill"></div>
            </div>
            <div id="password-strength-text"></div>
          </div>
        </div>

        <div class="form-group">
          <label for="password-confirm" class="form-label">${msg("confirmPassword")}</label>
          <input type="password" id="password-confirm" class="form-control" name="password-confirm"
                 autocomplete="new-password" placeholder="••••••••"/>
          <#if errors.passwordNotMatch??>
            <span class="error-text">${msg("errorPasswordMismatch")}</span>
          </#if>
        </div>

        <div id="kc-form-buttons">
          <button type="submit" id="kc-register" class="kc-btn kc-btn-primary">${msg("doRegister")}</button>
        </div>
      </form>

      <div id="kc-footer-links" style="margin-top: 1rem; text-align: center;">
        <a href="${url.loginUrl}">${msg("loginIdpConfirmDifferent")}</a>
      </div>
    </#if>

    <#if realm.emailAsUsername || userCreatedAccount>
      <form id="kc-register-form" action="${url.registrationAction}" method="post">
        <#if !userCreatedAccount>
          <div class="form-group">
            <label for="email" class="form-label">${msg("email")}</label>
            <input type="email" id="email" class="form-control" name="email"
                   value="${register.email}" autocomplete="email" placeholder="you@example.com" autofocus/>
            <#if errors.emailExists??>
              <span class="error-text">${msg("errorEmailAlreadyExists")}</span>
            </#if>
          </div>
        </#if>

        <div class="form-group">
          <label for="firstName" class="form-label">${msg("firstName")}</label>
          <input type="text" id="firstName" class="form-control" name="firstName"
                 value="${(register.firstName!'')}" autocomplete="given-name"/>
        </div>

        <div class="form-group">
          <label for="lastName" class="form-label">${msg("lastName")}</label>
          <input type="text" id="lastName" class="form-control" name="lastName"
                 value="${(register.lastName!'')}" autocomplete="family-name"/>
        </div>

        <div class="form-group">
          <label for="password" class="form-label">${msg("password")}</label>
          <input type="password" id="password" class="form-control" name="password"
                 autocomplete="new-password" placeholder="••••••••"/>
        </div>

        <div class="form-group">
          <label for="password-confirm" class="form-label">${msg("confirmPassword")}</label>
          <input type="password" id="password-confirm" class="form-control" name="password-confirm"
                 autocomplete="new-password" placeholder="••••••••"/>
          <#if errors.passwordNotMatch??>
            <span class="error-text">${msg("errorPasswordMismatch")}</span>
          </#if>
        </div>

        <div id="kc-form-buttons">
          <button type="submit" id="kc-register" class="kc-btn kc-btn-primary">${msg("doRegister")}</button>
        </div>
      </form>

      <div id="kc-footer-links" style="margin-top: 1rem; text-align: center;">
        <a href="${url.loginUrl}">${msg("loginIdpConfirmDifferent")}</a>
      </div>
    </#if>
  </div>
</@layout.displayLayout>
