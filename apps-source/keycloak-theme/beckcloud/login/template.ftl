<#macro displayLayout>
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${msg("loginTitle", (realm.displayName!""))}</title>
  <link rel="icon" type="image/svg+xml" href="${url.resourcesPath}/images/beckcloud-logo.svg">
  <link rel="stylesheet" href="${url.resourcesPath}/css/beckcloud.css">
  <#if style?has_content>
    <style>${style}</style>
  </#if>
</head>
<body>
  <div id="kc-container-wrapper">
    <div id="kc-container">
      <#nested "content">
    </div>
    <div id="kc-footer-wrapper">
      <div id="kc-footer">
        <p>&copy; ${.now?string("yyyy")} <a href="#">${realm.displayName!"BeckCloud"}</a></p>
      </div>
    </div>
  </div>
</body>
</html>
</#macro>
