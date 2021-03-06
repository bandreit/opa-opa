/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require("express"); // Express web server framework
var request = require("request"); // "Request" library
var cors = require("cors");
var querystring = require("querystring");
var cookieParser = require("cookie-parser");

var client_id = "8a70452bf45b47c1868986974b0186be"; // Your client id
var client_secret = "81204a59ce804920ad901d753d692e66"; // Your secret
var redirect_uri = "http://localhost:8888/callback"; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = "spotify_auth_state";

var app = express();

app
  .use(express.static(__dirname + "/public"))
  .use(cors())
  .use(cookieParser());

app.get("/login", function (req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope =
    "user-read-private user-read-email playlist-modify-public user-library-read playlist-modify-private playlist-modify";
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state,
      })
  );
});

app.get("/callback", function (req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect(
      "/#" +
        querystring.stringify({
          error: "state_mismatch",
        })
    );
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: "https://accounts.spotify.com/api/token",
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: "authorization_code",
      },
      headers: {
        Authorization:
          "Basic " +
          new Buffer(client_id + ":" + client_secret).toString("base64"),
      },
      json: true,
    };

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token,
          refresh_token = body.refresh_token;

        const formData = `{
          "name": "Zaibisi",
          "description": "Zaibisi Music",
          "public": false
        }`;

        const optionsForCreatingPlaylist = {
          url: `https://api.spotify.com/v1/me/playlists`,
          headers: {
            Authorization: "Bearer " + access_token,
            ContentType: "application/json",
          },
          json: true,
          form: formData,
        };

        request.post(optionsForCreatingPlaylist, function (
          error,
          response,
          body
        ) {
          const playlist_id = body.id;

          const addToPlaylist = (offset, limit) => {
            const optionsforGettingLikedSongs = {
              url: `https://api.spotify.com/v1/me/tracks?offset=${offset}&limit=${limit}`,
              headers: { Authorization: "Bearer " + access_token },
              json: true,
            };

            request.get(optionsforGettingLikedSongs, function (
              error,
              response,
              body
            ) {
              const tracks = body.items;
              const track_uris = tracks.map((track) => track.track.uri);
              const uris_for_req_first_half = track_uris.slice(0, 99).join(",");

              var optionsForAddingToPlaylist = {
                url: `https://api.spotify.com/v1/playlists/${playlist_id}/tracks?uris=${uris_for_req_first_half}`,
                headers: {
                  Authorization: "Bearer " + access_token,
                  ContentType: "application/json",
                },
                json: true,
              };

              request.post(optionsForAddingToPlaylist, function (
                error,
                response,
                body
              ) {
                console.log(response.body);
              });
            });
          };

          addToPlaylist(0, 50);
          addToPlaylist(50, 50);
          addToPlaylist(100, 50);
          addToPlaylist(150, 40);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect(
          "/#" +
            querystring.stringify({
              access_token: access_token,
              refresh_token: refresh_token,
            })
        );
      } else {
        res.redirect(
          "/#" +
            querystring.stringify({
              error: "invalid_token",
            })
        );
      }
    });
  }
});

app.get("/refresh_token", function (req, res) {
  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      Authorization:
        "Basic " +
        new Buffer(client_id + ":" + client_secret).toString("base64"),
    },
    form: {
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    },
    json: true,
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        access_token: access_token,
      });
    }
  });
});

console.log("Listening on 8888");
app.listen(8888);
