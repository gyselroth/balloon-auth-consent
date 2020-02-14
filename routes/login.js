const express = require('express');
const router = express.Router();
const url = require('url');
const hydra = require('../services/hydra')
const config = require('../services/config');
const http = require('http');
const { Issuer } = require('openid-client');
const got = require('got');

const locales = [
  ['en',  'English'],
  ['en-US', 'English (USA)'],
  ['en-AU', 'English (Australia)'],
  ['en-GB', 'English (UK)'],
  ['de',  'Deutsch'],
  ['de-CH', 'Deutsch (Schweiz)'],
  ['de-DE', 'Deutsch (Deutschland)'],
  ['de-AT', 'Deutsch (Österreich)']
];

// Sets up csrf protection
var csrf = require('csurf');
var csrfProtection = csrf({ cookie: true });

router.get('/oidc', csrfProtection, function (req, res, next) {
  const params = client.callbackParams(req);

  return client.callback('https://client.example.com/callback', params).then(function (tokenSet) {
    console.log('received and validated tokens %j', tokenSet);
    console.log('validated ID Token claims %j', tokenSet.claims());

    return redirectToHydra(challenge, 'foo@bar.com', true, res, next);
  }).catch(function(err) {
    console.log(err);

    res.render('login', {
      oidcProviders: config.oidcProviders || [],
      locales: locales,
      csrfToken: req.csrfToken(),
      challenge: challenge,
      error: 'login.error.oidc'
    });
  });
});

router.get('/', csrfProtection, function (req, res, next) {
  // Parses the URL query
  var query = url.parse(req.url, true).query;

  // The challenge is used to fetch information about the login request from ORY Hydra.
  var challenge = query.login_challenge;

  hydra.getLoginRequest(challenge)
  // This will be called if the HTTP request was successful
    .then(function (response) {
      // If hydra was already able to authenticate the user, skip will be true and we do not need to re-authenticate
      // the user.
      if (response.skip) {
        // You can apply logic here, for example update the number of times the user logged in.
        // ...

        // Now it's time to grant the login request. You could also deny the request if something went terribly wrong
        // (e.g. your arch-enemy logging in...)
        return hydra.acceptLoginRequest(challenge, {
          // All we need to do is to confirm that we indeed want to log in the user.
          subject: response.subject
        }).then(function (response) {
          // All we need to do now is to redirect the user back to hydra!
          res.redirect(response.redirect_to);
        });
      }

      // If authentication can't be skipped we MUST show the login UI.
      res.render('login', {
        oidcProviders: config.oidcProviders || [],
        locales: locales,
        csrfToken: req.csrfToken(),
        challenge: challenge,
      });
    }).catch(function (error) {
      next(error);
    });
});

function getOidcByUrl(url) {
  for(let provider of config.oidcProviders || []) {
    if(provider.providerUrl == url) {
      return provider;
    }
  }

  throw new Error("Provider not found");
}

function redirectToHydra(challenge, subject, remember, res, next) {
  // Seems like the user authenticated! Let's tell hydra...
  return hydra.acceptLoginRequest(challenge, {
    // Subject is an alias for user ID. A subject can be a random string, a UUID, an email address, ....
    subject: subject,

    // This tells hydra to remember the browser and automatically authenticate the user in future requests. This will
    // set the "skip" parameter in the other route to true on subsequent requests!
    remember: remember,

    // When the session expires, in seconds. Set this to 0 so it will never expire.
    remember_for: 3600,

    // Sets which "level" (e.g. 2-factor authentication) of authentication the user has. The value is really arbitrary
    // and optional. In the context of OpenID Connect, a value of 0 indicates the lowest authorization level.
    // acr: '0',
  }).then(function (response) {
      // All we need to do now is to redirect the user back to hydra!
      res.redirect(response.redirect_to);
  }).catch(function (error) {
      console.log("redirection to hydra failed", error);
      // This will handle any error that happens when making HTTP calls to hydra
      next(error);
  });
}

router.post('/', csrfProtection, function (req, res, next) {
  // The challenge is now a hidden input field, so let's take it from the request body instead
  var challenge = req.body.challenge;
  var authEndpoint = process.env.BALLOON_AUTH_URL || 'http://balloon-proxy/auth';
  var redirectUri = process.env.BALLOON_REDIRECT_URI || 'http://localhost:8084/login/oidc';

  if(req.body.submit) {
    console.log("authenticate request at ", authEndpoint);

    console.log("test", "first");

    (async () => {
      var error;

    	try {
    		const authRes = await got(authEndpoint,{
          username: req.body.username,
          password: req.body.password
        });

        console.log("authenticate request ended with status ", authRes.statusCode, authRes.body);
        var body = JSON.parse(authRes.body);

        if(authRes.statusCode === 401 || !body.identity) {
          error = 'login.error.credentials';
        } else if(authRes.statusCode === 200 ) {
          return redirectToHydra(challenge, body.identity, false, res, next);
        } else {
          error = 'login.error.server';
        }
    	} catch (error) {
        console.log("test", error);
        error = 'login.error.server';
    	}

      res.render('login', {
        oidcProviders: config.oidcProviders || [],
        locales: locales,
        csrfToken: req.csrfToken(),
        challenge: challenge,
        error: error
      });
    })();
  } else if(req.body.oidc) {
    var provider = getOidcByUrl(req.body.oidc);

    return Issuer.discover(req.body.oidc).then(function (issuer) {
      console.log('discovered issuer %s %O', issuer.issuer, issuer.metadata);

      const client = new issuer.Client({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        redirect_uris: ["http://localhost:3001/login/oidc"],
        response_types: ['code'],
      });

      const url = client.authorizationUrl({
        scope: 'openid email profile',
        resource: 'https://localhost:3001'
      });

      console.log("redirect client to authorization url ", url);
      res.redirect(url);
    });
  } else {
    res.render('login', {
      oidcProviders: config.oidcProviders || [],
      locales: locales,
      csrfToken: req.csrfToken(),
      challenge: challenge,
      error: 'login.error.server'
    });
  }
});

module.exports = router;
