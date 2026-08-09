<#import "template.ftl" as layout>
<@layout.displayLayout>
  <div id="kc-logo-wrapper">
    <#if logoUrl?has_content>
      <img src="${logoUrl}" alt="BeckCloud" id="kc-logo"/>
    <#else>
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
    </#if>
  </div>

  <div id="kc-header-wrapper">
    <div id="kc-header" class="kc-logo-text"><#nested "header"></div>
  </div>

  <div id="kc-card">
    <form id="kc-form-login" onsubmit="login.disabled = true" action="${url.loginUrl}" method="post">
      <#if !realm.loginWithEmailAllowed>
        <div class="form-group">
          <label for="username" class="form-label">${msg("username")}</label>
          <input id="username" class="form-control" name="username" value="${login.username}"
                 autocomplete="username" placeholder="${msg('loginUsernameHint')}" autofocus/>
        </div>
      <#elseif !realm.registrationEmailAsUsername>
        <div class="form-group">
          <label for="username" class="form-label">${msg("username")}</label>
          <input id="username" class="form-control" name="username" value="${login.username}"
                 autocomplete="username" placeholder="${msg('loginUsernameHint')}" autofocus/>
        </div>
      </#if>

      <#if realm.loginWithEmailAllowed && realm.registrationEmailAsUsername>
        <div class="form-group">
          <label for="username" class="form-label">${msg("username")}</label>
          <input id="username" class="form-control" name="username" value="${login.username}"
                 autocomplete="username" placeholder="${msg('loginUsernameHint')}" autofocus/>
        </div>
      </#if>

      <div class="form-group">
        <label for="password" class="form-label">${msg("password")}</label>
        <input id="password" class="form-control" name="password" type="password" autocomplete="current-password"
               placeholder="${msg('loginPasswordHint')}"/>
      </div>

      <div class="form-group" id="kc-form-options">
        <#if realm.rememberMe && login.rememberMe?has_content>
          <div class="checkbox-group">
            <input type="checkbox" id="rememberMe" name="rememberMe" value="on"
                   <#if login.rememberMe?has_content>checked</#if>>
            <label for="rememberMe" class="checkbox-label">${msg("rememberMe")}</label>
          </div>
        </#if>
      </div>

      <div id="kc-form-buttons">
        <button type="submit" id="kc-login" class="kc-btn kc-btn-primary">${msg("doLogIn")}</button>
      </div>
    </form>

    <#if (realm.resetPasswordAllowed || realm.registrationAllowed || realm.editUsernameAllowed)>
      <div class="kc-divider">
        <span>${msg("loginIdpConfirmUsername")}</span>
      </div>
      <div id="kc-footer-links">
        <#if realm.resetPasswordAllowed>
          <a href="${url.loginResetUrl}">${msg("loginPasswordResetLink")}</a>
        </#if>
        <#if realm.registrationAllowed>
          <a href="${url.registrationUrl}">${msg("loginRegisterLink")}</a>
        </#if>
        <#if realm.editUsernameAllowed>
          <a href="${url.loginUrl}?username=${login.username}">${msg("loginIdpConfirmDifferent")}</a>
        </#if>
      </div>
    </#if>

    <#if realm.password && social.providers?has_content>
      <div class="kc-divider">
        <span>${msg("loginSocialProviders")}</span>
      </div>
      <div id="kc-social-providers">
        <ul>
          <#list social.providers as p>
            <li>
              <a href="${p.loginUrl}" class="social-provider-btn">
                <span>${p.displayName}</span>
              </a>
            </li>
          </#list>
        </ul>
      </div>
    </#if>
  </div>
</@layout.displayLayout>
