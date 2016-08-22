// Offline Bound loader
// load json of Bound
// load media and replace paths
var request = require('request')

var API_HOST = "https://actionbound.com/api/2.7/"
var MEDIA_CAPABLE_FIELDS = ['content', 'problem', 'description', 'ceremony']
var IMAGE_RE = /\((https:\/\/content.actionbound.com\/user\/\w*\/image\/(1000\/)?\w*\.\w*)\)/g
var AUDIO_RE = /data-file=\'(https:\/\/content.actionbound.com\/user\/\w*\/audio\/mp3\/\w*\.mp3)\'/g
var VIDEO_RE = /src=\'(https:\/\/content.actionbound.com\/user\/\w*\/video\/480\/mp4\/\w*\.mp4)\'/g
var CHECK_FOR = [ IMAGE_RE, AUDIO_RE, VIDEO_RE ]

if (process.argv.length <= 2) {
  console.log("Usage: " + __filename + " BOUNDURL")
  process.exit(-1)
}
var url = process.argv[2]

request(API_HOST + "bounds?url=" + url, function (error, response, body) {
  var bound_info = JSON.parse(body)[0]

  request(API_HOST + "bound/" + url + "/" + bound_info._revision_id, function (error, response, body) {
    var bound = JSON.parse(body)

    bound.content = bound.content.map(function(element) {
      MEDIA_CAPABLE_FIELDS.map(function (field) {
        if(field in element) {
          CHECK_FOR.map(function (re) {
            var match = re.exec(element[field])
            while(match != null) {
              console.log(match[0])
              match = re.exec(element.field)
            }
          })
        }
      })
      return element
    })
  })
})
