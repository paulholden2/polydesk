/**
 * Account.js
 *
 * @description :: A model definition.  Represents a database table/collection/etc.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {
  attributes: {
    name: {
      type: 'string',
      required: true,
      unique: true
    },
    users: {
      collection: 'User',
      via: 'accounts'
    },
    groups: {
      collection: 'UserGroup',
      via: 'account'
    },
    workflows: {
      collection: 'Workflow',
      via: 'account'
    }
  }
};
