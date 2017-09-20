const moment = require('moment');
const toFixed = require('./utilities').fixedDecimals;

function Position(id, timestamp, status, type, amount, price, pl)
{
    const self = this;

    self.id = id;
    self.timestamp = timestamp;
    self.status = status;
    self.type = type;
    self.amount = amount;
    self.price = price;
    self.pl = pl;

    self.sheetsFormat = function ()
    {
        return {
            time: moment(new Date(self.timestamp)).format('MM/DD HH:mm:ss'),
            price: self.price,
            type: self.type,
            status: self.status,
            amountUSD: toFixed(self.amount * self.price, 8),
            amountBTC: toFixed(self.amount, 8),
            pl: self.pl
        };
    };
    return self;
}

function ConstructorFromRest(data)
{
    const id = data.id;
    const timestamp = parseInt(data.timestamp) * 1000;
    const amount = parseFloat(data.amount);
    const type = amount > 0 ? 'buy' : 'sell';
    const price = parseFloat(data.base);
    const pl = parseFloat(data.pl);
    const status = data.status;

    return new Position(id, timestamp, status, type, amount, price, pl);
}

module.exports = Position;
module.exports.FromRest = ConstructorFromRest;