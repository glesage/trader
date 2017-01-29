var moment = require('moment');

function order(id, timestamp, status, type, amount, price, fee)
{
    this.id = id;
    this.timestamp = timestamp;
    this.status = status;
    this.type = type;
    this.amount = amount;
    this.price = price;
    this.fee = fee;

    this.sheetsFormat = function ()
    {
        return {
            time: moment(new Date(this.timestamp)).format('MM/DD HH:mm:ss'),
            price: this.price,
            type: this.type,
            status: this.status,
            amountUSD: this.amount * this.price,
            amountBTC: this.ammout,
            fee: this.fee
        };
    };
}

function constructorFromSocket(data)
{
    var rawAmount = parseFloat(data[4]);

    var id = data[0];
    var timestamp = parseInt(data[2]) * 1000;
    var type = data[4] > 0 ? 'buy' : 'sell';
    var amount = rawAmount > 0 ? rawAmount : -rawAmount;
    var price = parseFloat(data[5]);
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
    var price = parseFloat(data.price);
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
    var price = parseFloat(data.price);
    var fee = parseFloat(data.fee_amount);
    var status = "EXECUTED";

    return new order(id, timestamp, status, type, amount, price, fee);
}

module.exports = order;
module.exports.fromSocket = constructorFromSocket;
module.exports.fromRestA = constructorFromRestA;
module.exports.fromRestL = constructorFromRestL;
