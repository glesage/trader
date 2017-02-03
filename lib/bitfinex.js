/* Dependencies */
var BitfinexWS = require('bitfinex-api-node');
var Order = require('./order');
var toFixed = require('./utilities').fixedDecimals;

function bitfinex(gotTradePrices, gotOrderUpdate)
{
    var self = this;

    self.rest = new BitfinexWS(process.env.BIT_REST_KEY, process.env.BIT_REST_SECRET).rest;
    self.placeOrder = placeOrder;
    self.updateOrder = updateOrder;
    self.gotTradePrices = gotTradePrices;
    self.gotOrderUpdate = gotOrderUpdate;
    self.getUpdatedBalances = getUpdatedBalances;

    var updatingBalances = false;
    var bws = new BitfinexWS(process.env.BIT_WS_KEY, process.env.BIT_WS_SECRET).ws;

    bws.on('trade', onTrade);
    bws.on('ts', onSnapshot);
    bws.on('error', console.error);

    self.start = function ()
    {
        bws.subscribeTrades('BTCUSD');
        bws.auth();
    };

    return self;


    function placeOrder(order, madeOrderCallback)
    {
        self.rest.new_order(
            order.symbol,
            order.amount,
            order.price,
            order.exchange,
            order.side,
            order.type,
            madeOrderCallback);
    }

    function updateOrder(order, newPrice, updatedOrderCallback)
    {
        if (!order.id) return updatedOrderCallback();

        // If the new price is somehow the same as the old, return the old order
        if (newPrice === order.price) return updatedOrderCallback(null, order);

        // New amount must be slightly less since the price is higher
        var newAmount = order.amount - (order.amount * (1 - (order.price / newPrice)));
        newAmount = toFixed(newAmount, 8);

        // If the new amount is somehow the same as the old, return the old order
        if (newAmount === order.amount) return updatedOrderCallback(null, order);

        self.rest.replace_order(
            order.id,
            'btcusd',
            newAmount,
            newPrice,
            'bitfinex',
            'buy',
            'exchange limit',
            updatedOrderCallback);
    }

    function onTrade(pair, trade)
    {
        var tradePrice = parseFloat(trade.price);
        self.gotTradePrices(tradePrice);
    }

    function onSnapshot(snapshot)
    {
        if (!snapshot || !snapshot.length) return;
        var order = new Order.fromSocket(snapshot);
        self.gotOrderUpdate(order);
    }

    function getUpdatedBalances(callback)
    {
        if (updatingBalances) return;

        updatingBalances = true;
        self.rest.wallet_balances(function (err, res)
        {
            if (err || !res || !res.length)
            {
                updatingBalances = false;
                return callback();
            }

            var btcBalance = res.find(function (b)
            {
                return b.currency === "btc" && b.type === 'exchange';
            });
            var usdBalance = res.find(function (b)
            {
                return b.currency === "usd" && b.type === 'exchange';
            });
            var balances = {};
            try
            {
                if (btcBalance) balances.balanceBTC = parseFloat(btcBalance.available);
                if (usdBalance) balances.balanceUSD = parseFloat(usdBalance.available);
            }
            catch (e)
            {
                console.log("Error parsing balances");
                console.log(e);
            }

            updatingBalances = false;
            return callback(balances);
        });
    }
}

module.exports = bitfinex;
