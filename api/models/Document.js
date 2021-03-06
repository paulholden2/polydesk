/**
 * Document.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

module.exports = {
  attributes: {
    name: {
      type: 'string',
      required: true
    },
    account: {
      model: 'Account',
      required: true
    },
    fileType: {
      type: 'string',
      required: true,
      isIn: sails.config.polydesk.supportedFileTypes
    }
  }
};
