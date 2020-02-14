const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const RobotstxtPlugin = require("robotstxt-webpack-plugin");

var isDev = false;//process.env.NODE_ENV !== 'production';

module.exports = {
  context: path.resolve(__dirname, 'public', 'src'),
  mode: 'production',
  entry: {
    balloon: './auth.js',
  },
  output: {
    path: path.resolve(__dirname, 'public', 'build', 'login')
  },
  mode: isDev ? 'development' : 'production',
  devtool: isDev ? 'source-map' : false,
  module: {
    rules: [
      {
        test    : /\.(png|jpg|svg|gif|eot|woff|woff2|ttf)$/,
        loader  : 'url-loader?limit=30000&name=assets/[name].[hash].[ext]'
      },
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"]
          }
        }
      },
      /*{
        test: /(\.jsx|\.js)$/,
        loader: 'eslint-loader',
        exclude: /node_modules/
      },*/
      {
        test: /\.scss$/,
        use: [
          {
            loader: isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          },
          {
            loader: "css-loader",
            options: {
              minimize: true,
              sourceMap: isDev
            }
          },
          {
            loader: "sass-loader",
            options: {
              outputStyle: "compressed",
              sourceMap: isDev
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css",
      chunkFilename: "[name].[id].css"
    }),
    new RobotstxtPlugin({
      policy: [{
        userAgent: "*",
        disallow: "/",
      }]
    })
  ]
};
