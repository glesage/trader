/* Dependencies */
var BitfinexWS = require('bitfinex-api-node');
var Order = require('./order');

function bitfinex(logTradePrices, logOrderUpdate)
{
    var self = this;

    self.rest = new BitfinexWS(process.env.BIT_REST_KEY, process.env.BIT_REST_SECRET).rest;
    bws = new BitfinexWS(process.env.BIT_WS_KEY, process.env.BIT_WS_SECRET).ws;

    bws.on('trade', onTrade);
    bws.on('ts', onSnapshot);
    bws.on('error', console.error);

    self.start = function ()
    {
        bws.subscribeTrades('BTCUSD');
        bws.auth();
    };

    self.logTradePrices = logTradePrices;
    self.logOrderUpdate = logOrderUpdate;

    return self;

    function onTrade(pair, trade)
    {
        var tradePrice = parseFloat(trade.price);
        self.logTradePrices(tradePrice);
    }

    function onSnapshot(snapshot)
    {
        if (!snapshot || !snapshot.length) return;
        var order = new Order.fromSocket(snapshot);
        self.logOrderUpdate(order);
    }
}

module.exports = bitfinex;
