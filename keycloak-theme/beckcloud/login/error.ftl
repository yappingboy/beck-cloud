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
    <div id="kc-header">${msg("errorTitle")}</div>
  </div>

  <div id="kc-card">
    <div id="kc-message">
      <h3 id="alert-title">${kcSanitize(msg(error.ftl!error.message))!''}</h3>
      <p>${kcSanitize(msg(errorDetails.ftl!error.message))!''}</p>
    </div>

    <div id="kc-form-buttons" style="margin-top: 1.5rem;">
      <#if skipLink?has_content && skipLink>
        <#if url.backLink?has_content>
          <a href="${url.backLink}" class="kc-btn kc-btn-secondary">${msg("doBack")}</a>
        </#if>
      <#else>
        <#if url.loginUrl?has_content>
          <a href="${url.loginUrl}" class="kc-btn kc-btn-secondary">${msg("doLogIn")}</a>
        </#if>
      </#if>
    </div>
  </div>
</@layout.displayLayout>
