var _ = require('lodash');
var ip = _(require('os').networkInterfaces())
    .values()
    .flatten()
    .filter(val=> (val.family == 'IPv4' && val.internal == false))
    .pluck('address')
    .first();

module.exports = ip;