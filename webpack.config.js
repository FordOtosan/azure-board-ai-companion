const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    index: './src/pages/WorkItemFormPage.tsx',
    aibot: './src/pages/AiBotPage.tsx',
    chat: './src/pages/ChatPage.tsx',
    settings: './src/pages/SettingsPage.tsx'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/pages/templates/index.html',
      filename: 'index.html',
      chunks: ['index']
    }),
    new HtmlWebpackPlugin({
      template: './src/pages/templates/aibot.html',
      filename: 'aibot.html',
      chunks: ['aibot']
    }),
    new HtmlWebpackPlugin({
      template: './src/pages/templates/chat.html',
      filename: 'chat.html',
      chunks: ['chat']
    }),
    new HtmlWebpackPlugin({
      template: './src/pages/templates/settings.html',
      filename: 'settings.html',
      chunks: ['settings']
    })
  ]
};