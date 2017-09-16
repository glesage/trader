const moment = require('moment');
const toFixed = require('./utilities').fixedDecimals;
const btfnxPrice = require('./utilities').btfnxPrice;

function order(id, timestamp, status, type, amount, price, fee)
{
    const self = this;

    self.id = id;
    self.timestamp = timestamp;
    self.status = status;
    self.type = type;
    self.amount = amount;
    self.price = price;
    self.fee = fee;

    self.sheetsFormat = function ()
    {
        return {
            time: moment(new Date(self.timestamp)).format('MM/DD HH:mm:ss'),
            price: self.price,
            type: self.type,
            status: self.status,
            amountUSD: toFixed(self.amount * self.price, 8),
            amountBTC: toFixed(self.amount, 8),
            fee: self.fee
        };
    };
    return self;
}

function constructorFromSocketUpdate(data)
{
    const rawAmount = parseFloat(data[5]);

    const id = data[1];
    const timestamp = parseInt(data[3]) * 1000;
    const type = rawAmount > 0 ? 'buy' : 'sell';
    const amount = rawAmount > 0 ? rawAmount : -rawAmount;
    const price = btfnxPrice(data[6]);
    const fee = parseFloat(data[9]);
    const status = 'EXECUTED';

    return new order(id, timestamp, status, type, amount, price, fee);
}

function constructorFromSocketNew(data)
{
    const rawAmount = parseFloat(data[2]);

    const id = data[0];
    const timestamp = Date.now();
    const type = rawAmount > 0 ? 'buy' : 'sell';
    const amount = rawAmount > 0 ? rawAmount : -rawAmount;
    const price = btfnxPrice(data[6]);
    const fee = null;
    const status = data[5];

    return new order(id, timestamp, status, type, amount, price, fee);
}

function constructorFromSocketTrade(data)
{
    const rawAmount = parseFloat(data.amount);

    const id = data.id;
    const timestamp = parseInt(data.timestamp) * 1000;
    const type = rawAmount > 0 ? 'buy' : 'sell';
    const amount = rawAmount > 0 ? rawAmount : -rawAmount;
    const price = btfnxPrice(data.price);
    const fee = null;
    const status = "EXECUTED";

    return new order(id, timestamp, status, type, amount, price, fee);
}

function constructorFromRestA(data)
{
    const id = data.id;
    const timestamp = parseInt(data.timestamp) * 1000;
    const type = data.side.toLowerCase();
    const amount = parseFloat(data.original_amount);
    const price = btfnxPrice(data.price);
    const fee = null;
    const status = "ACTIVE";

    return new order(id, timestamp, status, type, amount, price, fee);
}

function constructorFromRestL(data)
{
    const id = data.tid;
    const timestamp = parseInt(data.timestamp) * 1000;
    const type = data.type.toLowerCase();
    const amount = parseFloat(data.amount);
    const price = btfnxPrice(data.price);
    const fee = parseFloat(data.fee_amount);
    const status = "EXECUTED";

    return new order(id, timestamp, status, type, amount, price, fee);
}

module.exports = order;
module.exports.fromSocketU = constructorFromSocketUpdate;
module.exports.fromSocketN = constructorFromSocketNew;
module.exports.fromSocketT = constructorFromSocketTrade;
module.exports.fromRestA = constructorFromRestA;
module.exports.fromRestL = constructorFromRestL;