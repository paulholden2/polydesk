/**
 * DocumentController
 *
 * @description :: Server-side logic for managing documents
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

const querystring = require('querystring');
const skipperS3 = require('skipper-better-s3');
const path = require('path');
const AWS = require('aws-sdk');

module.exports = {
  browse: (req, res) => {
    Document.find({
      where: {
        account: req.session.account
      },
      skip: req.param('skip') || 0,
      limit: req.param('limit') || 20,
      sort: 'id ASC'
    }).exec((err, documents) => {
      if (err) {
        return res.serverError({
          message: err.message
        });
      }

      var accountId = req.session.account;
      var userId = req.session.user;

      documents = documents.map((doc) => {
        return {
          id: doc.id,
          name: doc.name,
          fileType: doc.fileType,
          href: `/viewer/${doc.id}`
        };
      });

      sails.helpers.getRootStructuredViews.with({
        account: req.session.account
      }).switch({
        success: (subviews) => {
          async.mapSeries(documents, (doc, callback) => {
            sails.helpers.getPinnedMetadata.with({
              account: accountId,
              user: userId,
              document: doc.id
            }).switch({
              success: (pinnedMetadata) => {
                callback(null, {
                  id: doc.id,
                  name: doc.name,
                  fileType: doc.fileType,
                  href: `/viewer/${doc.id}`,
                  pinnedMetadata: pinnedMetadata
                });
              },
              error: (err) => {
                callback(err);
              }
            });
          }, (err, results) => {
            if (err) {
              return res.serverError(err);
            }

            res.view('pages/documents', {
              layout: 'layouts/documents',
              documents: results,
              superview: null,
              subviews: subviews,
              bulkViewLink: false
            });
          });
        },
        error: (err) => {
          res.send(err);
        }
      });
    });
  },
  structuredView: (req, res) => {
    var viewId = req.param('view');
    var accountId = req.session.account;
    var userId = req.session.user;

    sails.helpers.generateStructuredView.with({
      view: viewId,
      account: accountId,
      filter: req.query
    }).switch({
      success: (view) => {
        Document.find({
          where: {
            id: view.documents.slice(0, 20)
          }
        }).exec((err, documents) => {
          if (err) {
            return res.status.send(err);
          }

          async.mapSeries(documents, (doc, callback) => {
            sails.helpers.getPinnedMetadata.with({
              account: accountId,
              user: userId,
              document: doc.id
            }).switch({
              success: (pinnedMetadata) => {
                callback(null, {
                  id: doc.id,
                  name: doc.name,
                  fileType: doc.fileType,
                  href: `/viewer/${doc.id}`,
                  pinnedMetadata: pinnedMetadata
                });
              },
              error: (err) => {
                callback(err);
              }
            });
          }, (err, results) => {
            if (err) {
              return res.serverError(err);
            }

            var query = querystring.stringify(req.query);

            // If we're looking at field folders, delete the metadata field
            // being expanded from the filter to get superview query
            if (typeof view.fieldFilter === 'object') {
              delete req.query[view.fieldFilter.metadataField];
            }

            // Query string for superview
            var upQuery = querystring.stringify(req.query);

            res.view('pages/documents', {
              layout: 'layouts/documents',
              documents: results,
              subviews: view.subviews,
              superview: view.superview,
              bulkViewLink: true,
              query: query,
              queryObject: req.query,
              upQuery: upQuery
            });
          });
        });
      },
      error: (err) => {
        res.send(err);
      }
    });
  },
  view: (req, res) => {
    var adapter = skipperS3({
      key: sails.config.documents.s3.key,
      secret: sails.config.documents.s3.secret,
      bucket: sails.config.documents.s3.bucket
    });

    async.waterfall([
      (callback) => {
        Document.findOne({
          account: req.session.account,
          id: req.param('document')
        }).exec((err, doc) => {
          if (err) {
            return callback(err);
          }

          if (!doc) {
            return callback(new Error('No document exists with that ID in this account'));
          }

          return callback(null, doc);
        });
      },
      (doc, callback) => {
        sails.helpers.getObjectMetadata.with({
          account: req.session.account,
          object: doc.id,
          objectType: 'document'
        }).switch({
          success: (metadataSets) => {
            callback(null, metadataSets);
          },
          error: (err) => {
            callback(err);
          },
          invalidObjectType: (err) => {
            callback(err);
          }
        });
      }
    ], (err, metadataSets) => {
      if (err) {
        return res.serverError({
          message: err.message
        });
      }

      return res.view('pages/viewer', {
        metadataSets: metadataSets,
        id: req.param('document'),
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
  // Web-only action. Replaces metadata set in the viewer metadata tab
  applyMetadata: (req, res) => {
    var metadataSets = req.body.metadataSets;
    var metadataOrdering = req.body.metadataOrdering;

    // TODO: Transaction? Or add sets, then remove sets not updated?
    async.waterfall([
      (callback) => {
        sails.helpers.removeAllObjectMetadataSets.with({
          account: req.session.account,
          object: req.param('document'),
          objectType: 'document'
        }).switch({
          success: (metadata) => {
            callback();
          },
          error: (err) => {
            callback(err);
          },
          invalidObjectType: (err) => {
            callback(err);
          }
        });
      },
      (callback) => {
        async.eachOf(metadataSets, (metadata, setName, callback) => {
          var order = metadataOrdering.indexOf(setName);

          if (order < 0) {
            return callback(new Error('Metadata set not ordered'));
          }

          sails.helpers.addObjectMetadataSet.with({
            account: req.session.account,
            object: req.param('document'),
            objectType: 'document',
            setName: setName,
            order: order,
            metadata: metadata
          }).switch({
            success: (metadata) => {
              callback();
            },
            error: (err) => {
              callback(err);
            },
            invalidObjectType: (err) => {
              callback(err);
            }
          });
        }, callback);
      }
    ], (err) => {
      if (err) {
        return res.serverError({
          message: err.message
        });
      }

      if (req.body.save) {
        res.redirect('/documents');
      } else {
        res.send({
          success: true,
          message: 'Metadata applied'
        });
      }
    });
  },
  upload: (req, res) => {
    req.file('file').upload({
      adapter: skipperS3,
      key: sails.config.documents.s3.key,
      secret: sails.config.documents.s3.secret,
      bucket: sails.config.documents.s3.bucket,
      region: 'us-west-2',
      s3params: {
        Key: 'queue/a.pdf'
      }
    }, (err, files) => {
      if (err) {
        return res.serverError({
          message: err.message
        });
      }

      if (files.length === 0) {
        return res.status(400).send({
          message: 'A file must be attached'
        });
      }

      var sqs = new AWS.SQS({
        accessKeyId: sails.config.documents.sqs.key,
        secretAccessKey: sails.config.documents.sqs.secret,
        region: sails.config.documents.sqs.region
      });

      async.mapSeries(files, (file, callback) => {
        var filename = file.filename;
        var ext = path.extname(file.filename);

        Document.create({
          name: path.basename(filename, ext),
          account: req.session.account,
          fileType: ext.slice(1) // so we don't get the dot before extension
        }).fetch().exec((err, doc) => {
          if (err) {
            return callback(err);
          }

          sqs.sendMessage({
            QueueUrl: sails.config.documents.sqs.url,
            MessageBody: JSON.stringify({
              document: doc
            }),
            MessageGroupId: 'DocumentUpload'
          }, (err, data) => {
            if (err) {
              return callback(err);
            }

            callback(null, doc);
          });
        });
      }, (err, documents) => {
        if (err) {
          return res.serverError(err);
        }

        res.redirect('/documents');
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
        return res.serverError({
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
        return res.serverError({
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
        return res.serverError({
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
