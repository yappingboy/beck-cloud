define(['baseUrl', 'Dashboard', 'emby-input', 'emby-button', 'emby-checkbox'], function (baseUrl, Dashboard) {
    'use strict';

    var pluginId = 'a2b4c6d8-e0f2-4a6c-8e0a-123456789abc';

    return function (view) {
        var form = view.querySelector('#OAuthProxyConfigForm');
        var saveStatus = view.querySelector('#saveStatus');

        view.addEventListener('viewshow', function () {
            Dashboard.showLoadingMsg();
            ApiClient.getPluginConfiguration(pluginId).then(function (config) {
                form.querySelector('#userInfoUrl').value = config.UserInfoUrl || '';
                form.querySelector('#cookieName').value = config.CookieName || '_oauth2_media';
                form.querySelector('#oauth2ProxyStartUrl').value = config.OAuth2ProxyStartUrl || '';
                form.querySelector('#jellyfinPublicUrl').value = config.JellyfinPublicUrl || '';
                form.querySelector('#adminGroups').value = config.AdminGroups || '';
                form.querySelector('#allowedGroups').value = config.AllowedGroups || '';
                form.querySelector('#autoCreateUsers').checked = config.AutoCreateUsers !== false;
                Dashboard.hideLoadingMsg();
            });
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            Dashboard.showLoadingMsg();

            ApiClient.getPluginConfiguration(pluginId).then(function (config) {
                config.UserInfoUrl = form.querySelector('#userInfoUrl').value;
                config.CookieName = form.querySelector('#cookieName').value;
                config.OAuth2ProxyStartUrl = form.querySelector('#oauth2ProxyStartUrl').value;
                config.JellyfinPublicUrl = form.querySelector('#jellyfinPublicUrl').value;
                config.AdminGroups = form.querySelector('#adminGroups').value;
                config.AllowedGroups = form.querySelector('#allowedGroups').value;
                config.AutoCreateUsers = form.querySelector('#autoCreateUsers').checked;

                ApiClient.updatePluginConfiguration(pluginId, config).then(function () {
                    Dashboard.processServerConfigurationUpdateResult();
                    saveStatus.textContent = 'Settings saved.';
                    saveStatus.style.display = 'block';
                    setTimeout(function () { saveStatus.style.display = 'none'; }, 3000);
                });
            });
        });
    };
});
