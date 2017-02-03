var moment = require('moment');
var toFixed = require('./utilities').fixedDecimals;
var btfnxPrice = require('./utilities').btfnxPrice;

function order(id, timestamp, status, type, amount, price, fee)
{
    var self = this;

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

function constructorFromSocket(data)
{
    var rawAmount = parseFloat(data[4]);

    var id = data[0];
    var timestamp = parseInt(data[2]) * 1000;
    var type = data[4] > 0 ? 'buy' : 'sell';
    var amount = rawAmount > 0 ? rawAmount : -rawAmount;
    var price = btfnxPrice(data[5]);
    var fee = -parseFloat(data[8]);
    var status = "EXECUTED";

    return new order(id, timestamp, status, type, amount, price, fee);
}

function constructorFromRestA(data)
{
    var id = data.id;
    var timestamp = parseInt(data.timestamp) * 1000;
    var type = data.side.toLowerCase();
    var amount = parseFloat(data.original_amount);
    var price = btfnxPrice(data.price);
    var fee = null;
    var status = "ACTIVE";

    return new order(id, timestamp, status, type, amount, price, fee);
}

function constructorFromRestL(data)
{
    var id = data.tid;
    var timestamp = parseInt(data.timestamp) * 1000;
    var type = data.type.toLowerCase();
    var amount = parseFloat(data.amount);
    var price = btfnxPrice(data.price);
    var fee = parseFloat(data.fee_amount);
    var status = "EXECUTED";

    return new order(id, timestamp, status, type, amount, price, fee);
}

module.exports = order;
module.exports.fromSocket = constructorFromSocket;
module.exports.fromRestA = constructorFromRestA;
module.exports.fromRestL = constructorFromRestL;
