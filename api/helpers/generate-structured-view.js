const arangoDb = require('arangojs');

module.exports = {
  friendlyName: 'Generate Structured View',
  description: 'Generate a list of documents described by a given structured view',
  inputs: {
    account: {
      type: 'number',
      required: true,
      description: 'The account ID owning the structured view'
    },
    view: {
      type: 'number',
      required: true,
      description: 'The structured view ID to generate'
    }
  },
  exits: {
    success: {
      outputFriendlyName: 'Document List',
      outputDescription: 'The list of documents in the given view'
    },
    error: {
      description: 'A server error occurred'
    }
  },
  fn: (inputs, exits) => {
    var db = new arangoDb.Database({
      url: sails.config.metadata.arangoDb.url
    });

    db.useDatabase(sails.config.metadata.arangoDb.database);
    db.useBasicAuth(sails.config.metadata.arangoDb.username, sails.config.metadata.arangoDb.password);

    var metadataSetsColl = sails.config.metadata.arangoDb.collection.replace('%account', inputs.account);
    var structuredViewsColl = `structured-views-${inputs.account}`;

    async.waterfall([
      (callback) => {
        db.query(`FOR view IN \`${structuredViewsColl}\` FILTER view._view == ${inputs.view} RETURN view`).then((cursor) => {
          var results = [];

          cursor.each((val) => results.push(val));

          if (results.length === 1) {
            callback(null, results[0]);
          } else {
            callback(new Error('Missing/multiple views found for ID ' + inputs.view));
          }
        }).catch(callback);
      },
      (view, callback) => {
        db.query(`FOR set IN \`${metadataSetsColl}\` FILTER ${view.filterExpression} RETURN DISTINCT set._object`).then((cursor) => {
          callback(null, cursor);
        }).catch(callback);
      },
      (cursor, callback) => {
        sails.helpers.getStructuredViewSuperview.with({
          account: inputs.account,
          view: inputs.view
        }).switch({
          success: (superview) => {
            callback(null, cursor, superview);
          },
          error: (err) => {
            callback(err);
          }
        });
      },
      (cursor, superview, callback) => {
        sails.helpers.getStructuredViewSubviews.with({
          account: inputs.account,
          view: inputs.view
        }).switch({
          success: (subviews) => {
            callback(null, cursor, superview, subviews);
          },
          error: (err) => {
            callback(err);
          }
        });
      }
    ], (err, cursor, superview, subviews) => {
      if (err) {
        return exits.error(err);
      }

      var results = [];

      cursor.each((val) => results.push(val));

      var view = {
        documents: [],
        superview: superview,
        subviews: subviews
      }

      results.forEach((obj) => {
        if (obj[0] === 'd') {
          view.documents.push(parseInt(obj.slice(1)));
        }
      });

      exits.success(view);
    });
  }
};