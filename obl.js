#!/usr/bin/env node

/* Copyright (C) Actionbound GbR - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Joantahn Rauprich <joni@actionbound.de>, August 2016
 */

var path = require('path')
var fs = require('fs')

var _ = require('lodash')
var async = require('async')
var Download = require('download');
var downloadStatus = require('download-status');
var request = require('request')
var mkdirp = require('mkdirp')

var argv = require('optimist')
  .usage('Usage: $0 --out DIRECTORY URL...')
  .demand(['o', 1])
  .alias('o', 'out')
  .describe('o', 'Output directory, usualy whitelabel merge')
  .alias('s', 'souce')
  .describe('s', 'Download source assets (only supports mp4, jpg, mp3 assets)')
  .argv

var API_HOST = 'https://actionbound.com/api/2.7/'
var MEDIA_CAPABLE_FIELDS = [ 'content', 'problem', 'description', 'ceremony' ]
var IMAGE_RE = /\((https:\/\/content.actionbound.com\/user\/\w*\/image\/(1000\/)?\w*\.\w*)\)/g
var AUDIO_RE = /data-file=\'(https:\/\/content.actionbound.com\/user\/\w*\/audio\/mp3\/\w*\.mp3)\'/g
var VIDEO_RE = /src=\'(https:\/\/content.actionbound.com\/user\/\w*\/video\/480\/mp4\/\w*\.mp4)\'/g
var CHECK_FOR = [ IMAGE_RE, AUDIO_RE, VIDEO_RE ]

var downloadBound = function(boundUrl, callback) {
  request(API_HOST + 'bounds?url=' + boundUrl, function (error, response, body) {
    var boundInfo = JSON.parse(body)[0]
    console.log('Got Bound: ' + boundInfo.title + ' https://actionbound.com/' + boundUrl)

    request(API_HOST + 'bound/' + boundUrl + '/' + boundInfo._revision_id, function (error, response, body) {
      var bound = JSON.parse(body)
      console.log('Checking for media in ' + bound.content.length + ' elements.')
      
      var media = []
      bound.content.map(function(element) {
        MEDIA_CAPABLE_FIELDS.map(function (field) {
          if(field in element) {
            CHECK_FOR.map(function (re) {
              var match = re.exec(element[field])
              while(match != null) {
                media.push(match[1])
                match = re.exec(element.field)
              }
            })
          }
        })
        return element
      })
      media = _.uniq(media)
      
      var mediaUrls = media.map(function (url) {
        if(argv.s) {
          url = url.replace('/1000/', '/')
          url = url.replace('/480/mp4/', '/')
          url = url.replace('/mp3/', '/')
        }
        return url
      })
      console.log('Found ' + media.length + ' media files to download.')
      var download = new Download()
      mediaUrls.map(function(url) {
        download.get(url)
      })

      var filePath = path.join(argv.out, 'public', 'bounds', boundUrl)
      mkdirp(filePath, function() {
        download
          .dest(filePath)
          .use(downloadStatus())
          .run(function() {
            bound.content = bound.content.map(function(element) {
              MEDIA_CAPABLE_FIELDS.map(function (field) {
                if(field in element) {
                  media.map(function(url) {
                    re = new RegExp(url, 'g')
                    element[field] = element[field].replace(re, '../bounds/' + boundUrl + '/' + path.basename(url))
                  })
                }
              })
              return element
            })

            var jsonPath = path.join(argv.out, 'app', 'assets', 'javascripts', 'actionbound', 'bounds')
            mkdirp(jsonPath, function() {
              fs.writeFile(
                path.join(jsonPath, boundUrl + '.js'),
                'Actionbound.Bounds.' + boundUrl + '=' + JSON.stringify(bound),
                callback)
            })
          })
      })
    })
  })
} 

async.eachSeries(argv._, downloadBound, function () {
  process.exit(0)
})
