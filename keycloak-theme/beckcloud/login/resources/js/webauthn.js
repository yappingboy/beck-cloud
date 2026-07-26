// BeckCloud Keycloak Theme — WebAuthn helper
(function() {
  'use strict';

  var btn = document.getElementById('webauthn-button');
  if (!btn) return;

  var form = document.getElementById('webauthn_form');
  var hiddenDataHash = document.getElementById('clientDataHash');
  var hiddenAppId = document.getElementById('publicKeyAppId');

  if (!window.PublicKeyCredential) {
    btn.textContent = 'WebAuthn not supported — try another method';
    btn.disabled = true;
    return;
  }

  btn.addEventListener('click', function() {
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    var opts;

    if (hiddenDataHash && hiddenDataHash.value) {
      // Passwordless authentication
      opts = {
        publicKey: {
          challenge: base64UrlToBuffer(hiddenDataHash.value),
          rpId: hiddenAppId ? hiddenAppId.value : undefined,
          userSelection: true
        }
      };
    } else {
      // Registered authenticator authentication
      opts = {
        publicKey: {
          challenge: base64UrlToBuffer(form.getAttribute('data-challenge')),
          allowCredentials: parseCredentials(form.getAttribute('data-credentials')),
          userSelection: true
        }
      };
    }

    navigator.credentials.get(opts)
      .then(function(assertion) {
        var formData = new FormData(form);
        formData.set('clientDataHash', assertion.response.clientDataJSON);
        formData.set('assertionId', assertion.id);
        formData.set('authenticatorData', assertion.response.authenticatorData);
        formData.set('signature', assertion.response.signature);
        formData.set('userHandle', assertion.response.userHandle ? bufferToBase64Url(assertion.response.userHandle) : '');
        form.submit();
      })
      .catch(function(err) {
        btn.disabled = false;
        btn.textContent = 'Try Again';
        console.error('WebAuthn error:', err);
      });
  });

  function base64UrlToBuffer(base64url) {
    var padding = '='.repeat((4 - (base64url.length % 4)) % 4);
    var base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + padding;
    var str = atob(base64);
    var buffer = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) {
      buffer[i] = str.charCodeAt(i);
    }
    return buffer;
  }

  function bufferToBase64Url(buffer) {
    var str = '';
    for (var i = 0; i < buffer.length; i++) {
      str += String.fromCharCode(buffer[i]);
    }
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function parseCredentials(jsonStr) {
    if (!jsonStr) return [];
    try {
      var parsed = JSON.parse(jsonStr);
      return parsed.map(function(c) {
        return {
          type: 'public-key',
          id: base64UrlToBuffer(c.id),
          transports: c.transports || []
        };
      });
    } catch(e) {
      return [];
    }
  }
})();
