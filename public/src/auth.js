/**
 * balloon
 *
 * @copyright Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license   GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

 import iconsSvg from '@gyselroth/icon-collection/src/icons.svg';
 import balloonCss from './scss/balloon.scss';

var login = {
  oidc: [],
  notifier: null,
  handler: null,
  mayHideLoader: true,
  recaptchaKey: null,

  init: function() {
    //this.recaptchaKey = config.recaptchaKey;
    this._initHash();
  },

  _initHash: function() {
    var hash = window.location.hash.substr(1);

    if(hash) {
      if(login.initOidcAuth(hash)) {
        login.mayHideLoader = false;
      } else {
        var pairs = this.parseAuthorizationResponse();
        if(pairs.access_token) {
          login.mayHideLoader = false;
        } else {
          //assume it is an internal balloon url
          localStorage.setItem('redirectAfterLogin', hash);
          login.replaceState('');
        }
      }
    }
  },

  replaceState: function(hash) {
    if(!window.history || !window.history.replaceState) {
      window.location.hash = hash;
    } else {
      window.history.replaceState(null, '', '#'+hash);
    }
  },

  parseAuthorizationResponse: function() {
    var hash = window.location.hash.substr(1);
    var obj = {};
    var pairs = hash.split('&');

    for(let i in pairs){
      let split = pairs[i].split('=');
      obj[decodeURIComponent(split[0])] = decodeURIComponent(split[1]);
    }

    return obj;
  },

  webauthnAuth: function() {
    var userId = localStorage.getItem('userId');
    var $webauth_error = $('#login-error-webauthn').hide();

    if(userId === null) {
      return;
    }

    login.xmlHttpRequest({
      url: '/api/v2/users/'+userId+'/request-challenges?domain='+window.location.hostname,
      type: 'POST',
      error: function(e) {
        $webauth_error.show();
      },
      success: function(resource) {
        let publicKey = resource.key;
        publicKey.challenge = Uint8Array.from(window.atob(publicKey.challenge), c=>c.charCodeAt(0));
        publicKey.allowCredentials = publicKey.allowCredentials.map(function(data) {
            return {
                ...data,
                'id': Uint8Array.from(atob(data.id), c=>c.charCodeAt(0))
            };
        });

        navigator.credentials.get({publicKey}).then(data => {
          let publicKeyCredential = {
            id: data.id,
            type: data.type,
            rawId: login.arrayToBase64String(new Uint8Array(data.rawId)),
            response: {
              authenticatorData: login.arrayToBase64String(new Uint8Array(data.response.authenticatorData)),
              clientDataJSON: login.arrayToBase64String(new Uint8Array(data.response.clientDataJSON)),
              signature: login.arrayToBase64String(new Uint8Array(data.response.signature)),
              userHandle: data.response.userHandle ? login.arrayToBase64String(new Uint8Array(data.response.userHandle)) : null
            }
          };

          login.doTokenAuth({
            grant_type: 'webauthn',
            public_key: publicKeyCredential,
            challenge: resource.id,
            user: userId,
          });
        }).catch(e => {
          $webauth_error.show();
        });
      }
    });
  },

  arrayToBase64String: function(a) {
    return btoa(String.fromCharCode(...a));
  },

  setupWebauthn: function() {
     var $d = $.Deferred();

    login.xmlHttpRequest({
      url: '/api/v2/creation-challenges?domain='+window.location.hostname,
      type: 'POST',
      success: function(resource) {
        let publicKey = resource.key;
        publicKey.challenge = Uint8Array.from(window.atob(publicKey.challenge), c=>c.charCodeAt(0));
        publicKey.user.id = Uint8Array.from(window.atob(publicKey.user.id), c=>c.charCodeAt(0));

        if (publicKey.excludeCredentials) {
          publicKey.excludeCredentials = publicKey.excludeCredentials.map(function(data) {
            return {
              ...data,
              'id': Uint8Array.from(window.atob(data.id), c=>c.charCodeAt(0))
            };
          });
        }

        navigator.credentials.create({publicKey}).then(function(data) {
          let publicKeyCredential = {
              id: data.id,
              type: data.type,
              rawId: login.arrayToBase64String(new Uint8Array(data.rawId)),
              response: {
                  clientDataJSON: login.arrayToBase64String(new Uint8Array(data.response.clientDataJSON)),
                  attestationObject: login.arrayToBase64String(new Uint8Array(data.response.attestationObject))
              }
          };

          login.xmlHttpRequest({
            url: '/api/v2/devices?challenge='+resource.id,
            data: publicKeyCredential,
            type: 'POST',
            success: function(publicKey) {
              localStorage.setItem('webauthn', 'true');
              $d.resolve();
            },
            error: function(e) {
              $d.reject(e);
            }
          });
        }).catch((e) => {
          $d.reject(e);
        });
      },
      error: function(e) {
        $d.reject(e);
      }
    });

    return $d;
  },

  getRecaptchaString: function() {
    var captcha = $('.g-recaptcha-response').val()
    if(captcha) {
      return '?g-recaptcha-response='+captcha;
    }

    return '';
  },

  displayRecaptcha: function() {
    $.getScript('https://www.google.com/recaptcha/api.js', function() {
      $('.g-recaptcha').attr('data-sitekey', login.recaptchaKey);
    });
  },

}

login.init();
