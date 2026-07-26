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
    <div id="kc-header">${msg("loginOauthGrantTitle")}</div>
  </div>

  <div id="kc-card">
    <div class="revoke-info">
      <p>${msg("loginOauthClientInfo")}</p>
      <p style="margin-top: 0.5rem; font-weight: 600; color: var(--ember); font-family: var(--font-heading);">${oauth.clientName!oauth.clientId!''}</p>
    </div>

    <#if oauth.scope?has_content && oauth.scopeByResource?has_content>
      <div style="margin-bottom: 1rem;">
        <strong style="font-size: 0.8125rem; color: var(--cloud);">${msg("loginOauthScopeTitle")}</strong>
        <ul style="list-style: none; padding: 0; margin-top: 0.5rem;">
          <#list oauth.scope?keys as scope>
            <li style="font-size: 0.8125rem; color: var(--frost); margin-bottom: 0.25rem;">
              <span style="color: var(--ember);">▸</span> ${msg("oauthScope_${scope}")!scope}
            </li>
          </#list>
        </ul>
      </div>
    </#if>

    <form id="kc-oauth-form" action="${url.loginAction}" method="post">
      <input type="hidden" name="code" value="${oauth.code!''}"/>
      <input type="hidden" name="referrer" value="${oauth.referrer!''}"/>
      <input type="hidden" name="referrer_name" value="${oauth.referrerName!''}"/>

      <div id="kc-form-buttons" style="display: flex; gap: 0.5rem;">
        <button type="submit" name="authorization" value="Allow" class="kc-btn kc-btn-primary">${msg("loginOauthGrant")}</button>
        <button type="submit" name="authorization" value="Deny" class="kc-btn kc-btn-ghost">${msg("loginOauthCancel")}</button>
      </div>
    </form>
  </div>
</@layout.displayLayout>
