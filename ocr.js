const fs = require('fs');
const async = require('async');
const readline = require('readline');
const path = require('path');
const exec = require('child_process').exec;
const skipper = require('skipper-disk');

require('sails').load({
  hooks: {
    blueprints: false,
    controllers: false,
    cors: false,
    csrf: false,
    grunt: false,
    helpers: false,
    http: false,
    i18n: false,
    logger: false,
    orm: false,
    policies: false,
    pubsub: false,
    request: false,
    responses: false,
    session: false,
    sockets: false,
    views: false
  }
}, function (err, app) {
  var adapter = skipper();
  var shutdown = false;

  if (process.platform === 'win32') {
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.on('SIGINT', () => {
      process.emit('SIGINT');
    });
  }

  process.on('SIGINT', () => {
    sails.log.info('OCR worker caught CTRL+C, shutting down');
    shutdown = true;
  });

  async.until(() => {
    return shutdown === true;
  }, (callback) => {
    async.waterfall([
      (callback) => {
        adapter.ls('./documents', (err, files) => {
          if (err) {
            return callback(err);
          }

          callback(null, files.filter((file) => {
            if (fs.lstatSync(file).isDirectory()) {
              return false;
            }

            if (file.indexOf('.pdf') < 0) {
              return false;
            }

            return true;
          }));
        });
      },
      (pdfs, callback) => {
        const gs = process.platform === 'win32' ? 'gswin64c' : 'gs';

        async.eachSeries(pdfs, (pdf, callback) => {
          async.waterfall([
            (callback) => {
              fs.mkdtemp(path.join(__dirname, '.tmp/ocr-'), callback);
            },
            (tmp, callback) => {
              exec(`${gs} -sDEVICE=pngmonod -dBATCH -dSAFER -dNOPAUSE -dDownScaleFactor=3 -r800 -q -sPAPERSIZE=a4 -sOutputFile=${tmp}/p%03d.png ${pdf}`, (err, stdin, stdout) => {
                if (err) {
                  return callback(err);
                }

                sails.log.info('Converted ' + pdf + ' to pages');
                fs.unlink(pdf, callback);
              });
            }
          ], callback);
        }, callback);
      },
      (callback) => {
        setTimeout(callback, 1000);
      }
    ], callback);
  }, (err) => {
    var code = 0;

    if (err) {
      sails.log.error(err);
      code = 1;
    }

    process.exit(code);
  });
});
