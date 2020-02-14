var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var login = require('./routes/login');
var logout = require('./routes/logout');
var consent = require('./routes/consent');
var config = require('./config.json');
var i18next = require("i18next");
var i18nextMiddleware = require("i18next-express-middleware");
var express = require("express");
const router = express.Router();

i18next.use(i18nextMiddleware.LanguageDetector).init({
  preload: ["en", "de"],
  resources: {
      de: {
          translation: require("./locales/de.json")
      },
      en: {
          translation: require("./locales/en.json")
      }
  }
});

var morgan = require('morgan')

var app = express();
app.use(morgan('combined'))

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public', 'build')));

app.use(
  i18nextMiddleware.handle(i18next, {
    removeLngFromUrl: false
  })
);

i18next.use(i18nextMiddleware.LanguageDetector).init();

app.use('/', router.get('/', function(req, res) {
  res.redirect('/login');
}));

app.use('/login', login);
app.use('/logout', logout);
app.use('/consent', consent);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function(err, req, res, next) {
  console.log(err);

  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
