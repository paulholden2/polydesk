/**
 * DocumentController
 *
 * @description :: Server-side logic for managing documents
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

const skipperS3 = require('skipper-better-s3');
const path = require('path');
const uuid = require('uuid/v4');

module.exports = {
  browse: (req, res) => {
    res.view('pages/documents');
  },
  view: (req, res) => {
    var adapter = skipperS3({
      key: sails.config.documents.s3.key,
      secret: sails.config.documents.s3.secret,
      bucket: sails.config.documents.s3.bucket
    });

    Document.findOne({
      account: req.session.account,
      id: req.param('document'),
    }).exec((err, doc) => {
      if (err) {
        return res.status(500).send({
          message: err.message
        });
      }

      if (!doc) {
        return res.status(404).send({
          message: 'No document exists with that ID in this account'
        });
      }

      return res.view('pages/viewer', {
        layout: 'layouts/viewer',
        documentUrl: adapter.url('getObject', {
          s3params: {
            Key: `documents/${req.param('document')}/document.pdf`,
            Expires: 60
          }
        })
      });
    });
  },
  upload: (req, res) => {
    var empty = req.file('file')._files.length === 0;

    if (empty) {
      return res.status(403).send({
        message: 'A file must be attached'
      });
    }

    var filename = req.file('file')._files[0].stream.filename;
    var ext = path.extname(filename).slice(1);

    Document.create({
      name: path.basename(filename, ext),
      account: req.session.account,
      fileType: ext
    }).fetch().exec((err, file) => {
      if (err) {
        return res.status(500).send({
          message: err.message
        });
      }

      req.file('file').upload({
        adapter: skipperS3,
        key: sails.config.documents.s3.key,
        secret: sails.config.documents.s3.secret,
        bucket: sails.config.documents.s3.bucket,
        region: 'us-west-2',
        s3params: {
          Key: 'queue/' + file.id + '.pdf'
        }
      }, (err, files) => {
        if (err) {
          return res.status(500).send({
            message: err.message
          });
        }

        res.status(200).send(files);
      });
    });
  },
  addMetadataSet: (req, res) => {
    sails.helpers.addObjectMetadataSet.with({
      account: req.session.account,
      object: req.param('documentId'),
      objectType: 'document',
      setName: req.body.setName,
      metadata: req.body.metadata
    }).switch({
      success: (data) => {
        return res.status(201).send(data);
      },
      error: (err) => {
        return res.status(500).send({
          message: err.message
        });
      },
      invalidObjectType: (err) => {
        return res.status(403).send({
          message: err.message
        });
      }
    });
  },
  updateMetadataSet: (req, res) => {
    sails.helpers.updateObjectMetadataSet.with({
      account: req.session.account,
      object: req.param('documentId'),
      objectType: 'document',
      setName: req.body.setName,
      metadata: req.body.metadata
    }).switch({
      success: (data) => {
        return res.status(200).send(data);
      },
      error: (err) => {
        return res.status(500).send({
          message: err.message
        });
      },
      invalidObjectType: (err) => {
        return res.status(403).send({
          message: err.message
        });
      }
    });
  },
  removeMetadataSet: (req, res) => {
    sails.helpers.removeObjectMetadataSet.with({
      account: req.session.account,
      object: req.param('documentId'),
      objectType: 'document',
      setName: req.body.setName
    }).switch({
      success: (data) => {
        return res.status(200).send(data);
      },
      error: (err) => {
        return res.status(500).send({
          message: err.message
        });
      },
      invalidObjectType: (err) => {
        return res.status(403).send({
          message: err.message
        });
      }
    });
  }
};
