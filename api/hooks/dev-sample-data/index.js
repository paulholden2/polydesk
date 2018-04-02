/**
 * Sample data for development environments
 *
 * Project hook to create some sample data after lifting.
 */

const AWS = require('aws-sdk');
const _ = require('lodash');

module.exports = (sails) => {
  return {
    initialize: (callback) => {
      if (process.env.NODE_ENV === 'production' || !_.get(sails, 'config.polydesk.generateSampleData')) {
        return callback();
      }

      sails.on('hook:orm:loaded', () => {
        async.waterfall([
          (callback) => {
            sails.helpers.createNewUser.with({
              email: 'rest@polydesk.com',
              password: 'password'
            }).switch({
              success: (user) => {
                sails.log.info('Created test user and account');

                callback(null, user);
              },
              error: (err) => {
                callback({
                  message: err.message
                });
              },
              accountAlreadyExists: (err) => {
                callback({
                  message: err.message
                });
              },
              userAlreadyExists: (err) => {
                callback({
                  message: err.message
                });
              }
            });
          },
          (user, callback) => {
            sails.log.info('Created test document');

            Document.create({
              account: user.defaultAccount,
              name: 'test',
              fileType: 'pdf'
            }).fetch().exec((err, doc) => {
              callback(err, user, doc);
            });
          },
          (user, doc, callback) => {
            sails.helpers.addObjectMetadataSet.with({
              account: user.defaultAccount,
              object: doc.id,
              objectType: 'document',
              setName: 'Test Set',
              metadata: {
                'Field 1': {
                  type: 'S',
                  value: 'StringValue'
                },
                'Field 2': {
                  type: 'N',
                  value: 125.38
                },
                'Field 3': {
                  type: 'B',
                  value: true
                },
                'Field 4': {
                  type: 'P',
                  value: '3.14159265358979323846264338327950288419716939937510'
                  // 2 * pi = 6.2831853071795864769252867665590057683943387987502
                },
                'Field 5': {
                  type: 'F',
                  value: '"Field 4" * 2'
                },
                'Field 6': {
                  type: 'F',
                  value: '"Field 7" + 1'
                },
                'Field 7': {
                  type: 'F',
                  value: '"Field 6" + 1'
                },
                'Field 8': {
                  type: 'F',
                  value: '"Field 5" + 1'
                }
              }
            }).switch({
              success: (metadataSet) => {
                sails.log.info('Created sample document metadata set');

                callback();
              },
              error: (err) => {
                callback({
                  message: err.message
                });
              },
              invalidObjectType: (err) => {
                callback({
                  message: err.message
                });
              }
            })
          }
        ], callback);
      });
    }
  };
}
