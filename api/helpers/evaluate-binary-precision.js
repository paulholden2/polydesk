const BigNumber = require('bignumber.js');

module.exports = {
  friendlyName: 'Evaluate Binary Precision',
  description: 'Evaluates a binary operation on two precision metadata values',
  sync: true,
  inputs: {
    lval: {
      type: 'ref',
      required: true
    },
    rval: {
      type: 'ref',
      required: true
    },
    operator: {
      type: 'string',
      enum: [
        '+',
        '-',
        '*',
        '/',
        '%',
        '^'
      ]
    }
  },
  exits: {
    success: {
      outputFriendlyName: 'Operation Result',
      outputDescription: 'Result of the operation'
    }
  },
  fn: (inputs, exits) => {
    var res;

    lval = new BigNumber(inputs.lval.value);
    rval = new BigNumber(inputs.rval.value);

    switch (inputs.operator) {
    case '*':
      res = lval.times(rval);
      break;
    case '+':
      res = lval.plus(rval);
      break;
    case '-':
      res = lval.minus(rval);
      break;
    case '/':
      res = lval.dividedBy(rval);
      break;
    case '%':
      res = lval.dividedToIntegerBy(rval);
      break;
    case '^':
      res = lval.exponentiatedBy(rval.toNumber());
      break;
    default:
      res = lval;
      break;
    }

    exits.success({
      type: 'P',
      value: res.toString()
    });
  }
};